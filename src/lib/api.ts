import type { Lang, ThemeMode, UserProfile } from '../types/lms.ts';

const TOKEN_KEY = 'maktab348_token';
const USER_KEY = 'maktab348_user';
const LANG_KEY = 'maktab348_lang';
const THEME_KEY = 'maktab348_theme';
const UI_STATE_KEY = 'maktab348_ui_state';

export function getStoredToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setStoredSession(token: string, user: UserProfile): void {
  try {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  } catch {
    // ignore storage quota
  }
}

export function updateStoredUser(user: UserProfile): void {
  try {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  } catch {
    // ignore
  }
}

export function getStoredUser(): UserProfile | null {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as UserProfile) : null;
  } catch {
    return null;
  }
}

export function clearStoredSession(): void {
  try {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(UI_STATE_KEY);
  } catch {
    // ignore
  }
}

export function getStoredLang(): Lang {
  try {
    const v = localStorage.getItem(LANG_KEY);
    if (v === 'uz' || v === 'ru' || v === 'en') return v;
  } catch {
    // ignore
  }
  return 'uz';
}

export function setStoredLang(lang: Lang): void {
  try {
    localStorage.setItem(LANG_KEY, lang);
  } catch {
    // ignore
  }
}

export function getStoredTheme(): ThemeMode {
  try {
    const v = localStorage.getItem(THEME_KEY);
    if (v === 'light' || v === 'dark') return v;
  } catch {
    // ignore
  }
  return 'light';
}

export function setStoredTheme(theme: ThemeMode): void {
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    // ignore
  }
}

export function saveUiTabState(key: string, value: string): void {
  try {
    const raw = localStorage.getItem(UI_STATE_KEY);
    const parsed = raw ? (JSON.parse(raw) as Record<string, string>) : {};
    parsed[key] = value;
    localStorage.setItem(UI_STATE_KEY, JSON.stringify(parsed));
  } catch {
    // ignore
  }
}

export function getUiTabState(key: string, fallback: string): string {
  try {
    const raw = localStorage.getItem(UI_STATE_KEY);
    const parsed = raw ? (JSON.parse(raw) as Record<string, string>) : {};
    return parsed[key] || fallback;
  } catch {
    return fallback;
  }
}

export class ApiError extends Error {
  status: number;
  data: Record<string, unknown>;
  constructor(status: number, message: string, data: Record<string, unknown> = {}) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

function formatReadableHttpError(status: number, rawText: string): string {
  const trimmed = rawText.trim();
  const isHtml =
    trimmed.startsWith('<!DOCTYPE') ||
    trimmed.startsWith('<html') ||
    trimmed.includes('<title>') ||
    trimmed.includes('<body');
  if (isHtml) {
    if (status === 502 || status === 503 || status === 504) {
      return `Server vaqtincha band (${status}). Iltimos, bir necha soniyadan so‘ng qayta urinib ko‘ring.`;
    }
    return `Serverdan kutilmagan javob keldi (${status}). Qayta urinib ko‘ring.`;
  }
  return trimmed || `Server xatosi (${status})`;
}

export async function apiFetch<T = unknown>(
  url: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getStoredToken();
  const headers = new Headers(options.headers || {});
  if (!headers.has('Content-Type') && options.body) {
    headers.set('Content-Type', 'application/json');
  }
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const maxAttempts = 3;
  let lastResponse: Response | null = null;
  let lastText = '';

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const response = await fetch(url, {
        ...options,
        headers,
        credentials: 'include',
      });
      lastResponse = response;
      lastText = await response.text();

      if (
        (response.status === 502 ||
          response.status === 503 ||
          response.status === 504) &&
        attempt < maxAttempts
      ) {
        await new Promise((r) => setTimeout(r, attempt * 900));
        continue;
      }
      break;
    } catch (networkErr) {
      if (attempt < maxAttempts) {
        await new Promise((r) => setTimeout(r, attempt * 900));
        continue;
      }
      throw new ApiError(
        503,
        networkErr instanceof Error && !networkErr.message.includes('<')
          ? 'Internet yoki server bilan aloqa uzildi. Qayta urinib ko‘ring.'
          : 'Server bilan aloqa uzildi. Qayta urinib ko‘ring.'
      );
    }
  }

  const response = lastResponse!;
  const text = lastText;
  let parsed: Record<string, unknown> = {};
  try {
    parsed = text ? (JSON.parse(text) as Record<string, unknown>) : {};
  } catch {
    parsed = { error: formatReadableHttpError(response.status, text) };
  }

  if (!response.ok) {
    throw new ApiError(
      response.status,
      String(parsed.error || formatReadableHttpError(response.status, text)),
      parsed
    );
  }
  return parsed as T;
}

export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Faylni o‘qib bo‘lmadi'));
    reader.readAsDataURL(file);
  });
}
