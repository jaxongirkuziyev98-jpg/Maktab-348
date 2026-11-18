import crypto from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';
import type { UserProfile, UserRole } from '../src/types/lms.ts';

const SESSION_SECRET =
  process.env.SESSION_SECRET || 'maktab348-dev-session-secret-change-in-prod';
export const SESSION_TTL_SECONDS = 365 * 24 * 60 * 60; // 365 days

export function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.startsWith('998') && digits.length === 12) return `+${digits}`;
  if (digits.length === 9) return `+998${digits}`;
  if (raw.trim().startsWith('+')) return `+${digits}`;
  return digits ? `+${digits}` : '';
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const parts = storedHash.split(':');
  if (parts.length !== 2) return false;
  const [salt, keyHex] = parts;
  const derived = crypto.scryptSync(password, salt, 64);
  const storedBuf = Buffer.from(keyHex, 'hex');
  if (derived.length !== storedBuf.length) return false;
  return crypto.timingSafeEqual(derived, storedBuf);
}

export interface TokenPayload {
  sub: string;
  role: UserRole;
  iat: number;
  exp: number;
}

export function signSessionToken(userId: string, role: UserRole): string {
  const now = Math.floor(Date.now() / 1000);
  const payload: TokenPayload = {
    sub: userId,
    role,
    iat: now,
    exp: now + SESSION_TTL_SECONDS,
  };
  const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const sig = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(encoded)
    .digest('base64url');
  return `${encoded}.${sig}`;
}

export function verifySessionToken(token: string): TokenPayload | null {
  if (!token || !token.includes('.')) return null;
  const [encoded, sig] = token.split('.');
  if (!encoded || !sig) return null;
  const expectedSig = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(encoded)
    .digest('base64url');
  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return null;
  }
  try {
    const parsed = JSON.parse(
      Buffer.from(encoded, 'base64url').toString('utf8')
    ) as TokenPayload;
    if (!parsed.sub || !parsed.role || parsed.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function extractTokenFromRequest(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7).trim();
    if (token) return token;
  }
  const cookieHeader = req.headers.cookie;
  if (cookieHeader) {
    const pairs = cookieHeader.split(';');
    for (const pair of pairs) {
      const idx = pair.indexOf('=');
      if (idx > -1) {
        const k = pair.slice(0, idx).trim();
        const v = pair.slice(idx + 1).trim();
        if (k === 'maktab348_token' && v) {
          return decodeURIComponent(v);
        }
      }
    }
  }
  if (typeof req.query?.token === 'string' && req.query.token) {
    return req.query.token;
  }
  return null;
}

export function setAuthCookie(res: Response, token: string): void {
  res.cookie('maktab348_token', token, {
    httpOnly: true,
    sameSite: 'none',
    secure: true,
    maxAge: SESSION_TTL_SECONDS * 1000,
    path: '/',
  });
}

export function clearAuthCookie(res: Response): void {
  res.clearCookie('maktab348_token', {
    httpOnly: true,
    sameSite: 'none',
    secure: true,
    path: '/',
  });
}

// In-memory OTP store with 5-minute TTL
interface OtpEntry {
  code: string;
  expiresAt: number;
}
const otpMap = new Map<string, OtpEntry>();

export function issueSmsCode(phone: string): string {
  const norm = normalizePhone(phone);
  const code = String(crypto.randomInt(100000, 999999));
  otpMap.set(norm, {
    code,
    expiresAt: Date.now() + 5 * 60 * 1000,
  });
  return code;
}

export function verifySmsCode(phone: string, code: string): boolean {
  const norm = normalizePhone(phone);
  const entry = otpMap.get(norm);
  if (!entry) return false;
  if (Date.now() > entry.expiresAt) {
    otpMap.delete(norm);
    return false;
  }
  if (entry.code !== code.trim()) return false;
  otpMap.delete(norm);
  return true;
}

export interface AuthedRequest extends Request {
  user?: UserProfile;
}

export function createAuthMiddleware(
  findUserById: (id: string) => UserProfile | undefined
) {
  return function requireAuth(
    req: AuthedRequest,
    res: Response,
    next: NextFunction
  ): void {
    const token = extractTokenFromRequest(req);
    if (!token) {
      res.status(401).json({ error: 'Avtorizatsiya talab qilinadi' });
      return;
    }
    const payload = verifySessionToken(token);
    if (!payload) {
      res.status(401).json({ error: 'Sessiya muddati tugagan yoki yaroqsiz' });
      return;
    }
    const user = findUserById(payload.sub);
    if (!user) {
      res.status(401).json({ error: 'Foydalanuvchi topilmadi' });
      return;
    }
    req.user = user;
    next();
  };
}

export function requireRole(...roles: UserRole[]) {
  return (req: AuthedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Avtorizatsiya talab qilinadi' });
      return;
    }
    if (!roles.includes(req.user.role)) {
      res.status(403).json({
        error: `Ushbu bo‘lim faqat ${roles.join(' / ')} roli uchun ruxsat etilgan.`,
      });
      return;
    }
    next();
  };
}

export function isSubscriptionActive(user: UserProfile): boolean {
  if (user.role !== 'student') return true;
  if (!user.subscriptionExpiresAt) return false;
  return new Date(user.subscriptionExpiresAt).getTime() > Date.now();
}

export function requirePaidStudent(
  req: AuthedRequest,
  res: Response,
  next: NextFunction
): void {
  if (!req.user) {
    res.status(401).json({ error: 'Avtorizatsiya talab qilinadi' });
    return;
  }
  if (req.user.role === 'student' && !isSubscriptionActive(req.user)) {
    res.status(402).json({
      error: 'O‘quvchi kabinetidan foydalanish uchun 30 kunlik obunani faollashtiring (10 000 so‘m).',
      code: 'PAYMENT_REQUIRED',
    });
    return;
  }
  next();
}
