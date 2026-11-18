import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';
import express from 'express';
import { createServer as createViteServer } from 'vite';
import {
  clearAuthCookie,
  createAuthMiddleware,
  hashPassword,
  isSubscriptionActive,
  issueSmsCode,
  normalizePhone,
  requirePaidStudent,
  requireRole,
  setAuthCookie,
  signSessionToken,
  verifyPassword,
  verifySmsCode,
  type AuthedRequest,
} from './server/auth.ts';
import {
  SUBSCRIPTION_DAYS,
  SUBSCRIPTION_PRICE_UZS,
  buildClickCheckoutUrl,
  buildPaymeCheckoutUrl,
  dispatchSms,
  getPaymentIntegrationStatus,
  runOverdueSmsScheduler,
  verifyClickSignature,
} from './server/integrations.ts';
import { generateEbookPdfBuffer } from './server/pdf.ts';
import {
  UPLOADS_DIR,
  loadDb,
  saveBase64Upload,
  saveDb,
  toPublicUser,
} from './server/store.ts';
import type {
  HomeworkAssignment,
  HomeworkSubmission,
  LanguageLevel,
  PaymentOrder,
  PaymentProvider,
  SchoolTest,
  TestAttemptResult,
  TestQuestion,
  UserRole,
} from './src/types/lms.ts';

dotenv.config();

const PORT = Number(process.env.PORT || 3000);
const app = express();

app.set('trust proxy', 1);
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true }));

const db = loadDb();
const requireAuth = createAuthMiddleware((id) => {
  const found = loadDb().users.find((u) => u.id === id);
  return found ? toPublicUser(found) : undefined;
});

function getRequestBaseUrl(req: express.Request): string {
  if (process.env.APP_URL && process.env.APP_URL !== 'MY_APP_URL') {
    return process.env.APP_URL;
  }
  const proto = (req.headers['x-forwarded-proto'] as string) || req.protocol || 'http';
  const host = req.headers['x-forwarded-host'] || req.headers.host || `localhost:${PORT}`;
  return `${proto}://${host}`;
}

function activateStudentSubscription(userId: string): string {
  const state = loadDb();
  const user = state.users.find((u) => u.id === userId);
  const now = Date.now();
  const baseTime =
    user?.subscriptionExpiresAt &&
    new Date(user.subscriptionExpiresAt).getTime() > now
      ? new Date(user.subscriptionExpiresAt).getTime()
      : now;
  const expiresAt = new Date(
    baseTime + SUBSCRIPTION_DAYS * 24 * 3600 * 1000
  ).toISOString();
  if (user) {
    user.subscriptionExpiresAt = expiresAt;
    state.notifications.unshift({
      id: `notif-${crypto.randomUUID()}`,
      userId: user.id,
      title: '30 kunlik obuna faollashtirildi ✓',
      message: `348-MAKTAB obunangiz ${new Date(expiresAt).toLocaleDateString('uz-UZ')} gacha faol.`,
      type: 'success',
      read: false,
      createdAt: new Date().toISOString(),
    });
  }
  return expiresAt;
}

// ============================================================
// AUTH ROUTES
// ============================================================

app.post('/api/auth/send-sms', async (req, res) => {
  const phone = normalizePhone(String(req.body?.phone || ''));
  if (!phone || phone.length < 12) {
    res.status(400).json({ error: 'Telefon raqamini to‘g‘ri kiriting (+998XXXXXXXXX).' });
    return;
  }
  const code = issueSmsCode(phone);
  const msg = `348-MAKTAB tasdiqlash kodi: ${code}`;
  const status = await dispatchSms(phone, msg);
  const smsConfigured = status === 'sent';
  res.json({
    ok: true,
    phone,
    smsConfigured,
    demoCode: smsConfigured ? undefined : code,
    message: smsConfigured
      ? 'Tasdiqlash kodi telefoningizga SMS orqali yuborildi.'
      : `SMS Gateway ulanmagan (DEMO rejim). Tasdiqlash kodi: ${code}`,
  });
});

app.post('/api/auth/register', async (req, res) => {
  const state = loadDb();
  const role = String(req.body?.role || 'student') as UserRole;
  if (role !== 'student' && role !== 'teacher') {
    res.status(403).json({
      error: 'Ro‘yxatdan o‘tish faqat O‘quvchi va O‘qituvchi rollari uchun ochiq.',
    });
    return;
  }

  const firstName = String(req.body?.firstName || '').trim();
  const lastName = String(req.body?.lastName || '').trim();
  const phone = normalizePhone(String(req.body?.phone || ''));
  const parentPhone = req.body?.parentPhone
    ? normalizePhone(String(req.body.parentPhone))
    : undefined;
  const email = String(req.body?.email || '').trim();
  const password = String(req.body?.password || '').trim();
  const smsCode = String(req.body?.smsCode || '').trim();
  const grade = Number(req.body?.grade);

  if (!firstName || !lastName || !phone || phone.length < 12) {
    res.status(400).json({ error: 'Ism, familiya va telefon raqamini to‘liq kiriting.' });
    return;
  }

  if (!verifySmsCode(phone, smsCode)) {
    res.status(400).json({ error: 'SMS tasdiqlash kodi noto‘g‘ri yoki muddati tugagan.' });
    return;
  }

  const existing = state.users.find((u) => u.phone === phone);
  if (existing) {
    res.status(409).json({
      error: 'Ushbu telefon raqami allaqachon ro‘yxatdan o‘tgan.',
      alreadyExists: true,
      existingRole: existing.role,
    });
    return;
  }

  if (role === 'student') {
    if (!Number.isInteger(grade) || grade < 1 || grade > 11) {
      res.status(400).json({ error: '1 dan 11 gacha sinfni tanlang.' });
      return;
    }
    const newStudent = {
      id: `user-${crypto.randomUUID()}`,
      role: 'student' as const,
      firstName,
      lastName,
      phone,
      parentPhone,
      grade,
      approved: true,
      subscriptionExpiresAt: null, // Must pay 10,000 UZS before entering Student Cabinet
      stars: grade <= 4 ? 20 : 0,
      medals: grade <= 4 ? ['Yangi bilimdon'] : [],
      passwordHash: hashPassword(password || phone),
      createdAt: new Date().toISOString(),
    };
    state.users.push(newStudent);
    await saveDb();

    const token = signSessionToken(newStudent.id, newStudent.role);
    setAuthCookie(res, token);
    res.status(201).json({
      token,
      user: toPublicUser(newStudent),
      requiresPayment: true,
    });
    return;
  }

  // Teacher registration: auto-approved, proceeds to circular face verification gate (FREE)
  if (!email || !email.includes('@')) {
    res.status(400).json({ error: 'O‘qituvchi uchun Gmail / Email manzilini kiriting.' });
    return;
  }
  if (!password || password.length < 4) {
    res.status(400).json({ error: 'Kamida 4 ta belgidan iborat parol kiriting.' });
    return;
  }

  const newTeacher = {
    id: `user-${crypto.randomUUID()}`,
    role: 'teacher' as const,
    firstName,
    lastName,
    phone,
    email,
    assignedGrades: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
    assignedSubjects: ['math', 'native_lang', 'english', 'informatics'],
    approved: true, // No admin approval required per user instruction
    faceVerified: false, // Completed in TeacherFaceVerificationGate right after registration
    passwordHash: hashPassword(password),
    createdAt: new Date().toISOString(),
  };
  state.users.push(newTeacher);
  await saveDb();

  const token = signSessionToken(newTeacher.id, newTeacher.role);
  setAuthCookie(res, token);
  res.status(201).json({
    token,
    user: toPublicUser(newTeacher),
    requiresFaceVerification: true,
  });
});

app.post('/api/auth/login', (req, res) => {
  const state = loadDb();
  const phone = normalizePhone(String(req.body?.phone || ''));
  const password = String(req.body?.password || '');
  const expectedRole = req.body?.role as UserRole | undefined;

  const user = state.users.find((u) => u.phone === phone);
  if (!user) {
    res.status(404).json({ error: 'Ushbu telefon raqami bilan hisob topilmadi.' });
    return;
  }

  if (expectedRole && user.role !== expectedRole) {
    const roleLabel =
      user.role === 'student'
        ? 'O‘quvchi'
        : user.role === 'teacher'
        ? 'O‘qituvchi'
        : 'Administrator';
    res.status(403).json({
      error: `Ushbu hisob ${roleLabel} roliga tegishli. Iltimos, ${roleLabel} bo‘limi orqali kiring.`,
    });
    return;
  }

  // Allow passwordless phone opening if user was created without custom password (passwordHash === hash(phone))
  const validPassword =
    verifyPassword(password, user.passwordHash) ||
    (!password && user.role === 'student' && verifyPassword(phone, user.passwordHash));

  if (!validPassword) {
    res.status(401).json({ error: 'Telefon raqami yoki parol noto‘g‘ri.' });
    return;
  }

  const token = signSessionToken(user.id, user.role);
  setAuthCookie(res, token);
  res.json({
    token,
    user: toPublicUser(user),
  });
});

app.post('/api/auth/quick-open-student', (req, res) => {
  const state = loadDb();
  const phone = normalizePhone(String(req.body?.phone || ''));
  const user = state.users.find((u) => u.phone === phone && u.role === 'student');
  if (!user) {
    res.status(404).json({ error: 'O‘quvchi topilmadi' });
    return;
  }
  const token = signSessionToken(user.id, user.role);
  setAuthCookie(res, token);
  res.json({ token, user: toPublicUser(user) });
});

app.post('/api/auth/quick-demo', (req, res) => {
  const state = loadDb();
  const phone = normalizePhone(String(req.body?.phone || ''));
  const user = state.users.find((u) => u.phone === phone);
  if (!user) {
    res.status(404).json({ error: 'Demo hisob topilmadi' });
    return;
  }
  const token = signSessionToken(user.id, user.role);
  setAuthCookie(res, token);
  res.json({ token, user: toPublicUser(user) });
});

app.post(
  '/api/auth/teacher-face',
  requireAuth,
  requireRole('teacher'),
  async (req: AuthedRequest, res) => {
    const imageBase64 = String(req.body?.imageBase64 || '');
    if (!imageBase64 || !imageBase64.startsWith('data:image/')) {
      res.status(400).json({ error: 'Yuz tasvirini to‘g‘ri yuklang.' });
      return;
    }
    try {
      const saved = saveBase64Upload('teacher-face.jpg', imageBase64);
      const state = loadDb();
      const teacher = state.users.find((u) => u.id === req.user!.id);
      if (!teacher) {
        res.status(404).json({ error: 'O‘qituvchi topilmadi' });
        return;
      }
      teacher.faceVerified = true;
      teacher.approved = true;
      teacher.avatarUrl = saved.url;
      await saveDb();
      res.json({ ok: true, user: toPublicUser(teacher) });
    } catch (err) {
      res.status(400).json({
        error: err instanceof Error ? err.message : 'Rasmni saqlashda xatolik',
      });
    }
  }
);

app.get('/api/auth/me', requireAuth, (req: AuthedRequest, res) => {
  res.json({ user: req.user });
});

app.post('/api/auth/logout', (_req, res) => {
  clearAuthCookie(res);
  res.json({ ok: true });
});

// ============================================================
// UPLOADS & E-BOOK PDF STREAMING
// ============================================================

app.get('/api/uploads/:filename', (req, res) => {
  const safeName = path.basename(req.params.filename);
  const fullPath = path.join(UPLOADS_DIR, safeName);
  if (!fs.existsSync(fullPath)) {
    res.status(404).json({ error: 'Fayl topilmadi' });
    return;
  }
  res.sendFile(fullPath);
});

app.get('/api/ebooks/:id/pdf', (req, res) => {
  const state = loadDb();
  const ebook = state.ebooks.find((b) => b.id === req.params.id);
  if (!ebook) {
    res.status(404).json({ error: 'Elektron kitob topilmadi' });
    return;
  }
  if (ebook.uploadedFileUrl) {
    const fileName = path.basename(ebook.uploadedFileUrl);
    const fullPath = path.join(UPLOADS_DIR, fileName);
    if (fs.existsSync(fullPath)) {
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        `inline; filename="${encodeURIComponent(ebook.id)}.pdf"`
      );
      res.sendFile(fullPath);
      return;
    }
  }
  const pdfBuf = generateEbookPdfBuffer(ebook);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader(
    'Content-Disposition',
    `inline; filename="${encodeURIComponent(ebook.id)}.pdf"`
  );
  res.send(pdfBuf);
});

// ============================================================
// PAYMENT & CLICK MERCHANT API ROUTES
// ============================================================

app.get('/api/payments/status', requireAuth, (req: AuthedRequest, res) => {
  const state = loadDb();
  const baseUrl = getRequestBaseUrl(req);
  const integrationStatus = getPaymentIntegrationStatus(baseUrl);
  const myOrders = state.paymentOrders
    .filter((o) => o.userId === req.user!.id)
    .slice(0, 20);
  res.json({
    integrationStatus,
    orders: myOrders,
    subscriptionActive: isSubscriptionActive(req.user!),
    subscriptionExpiresAt: req.user!.subscriptionExpiresAt || null,
  });
});

app.get('/api/payments/checkout-links', requireAuth, (req: AuthedRequest, res) => {
  const baseUrl = getRequestBaseUrl(req);
  const integrationStatus = getPaymentIntegrationStatus(baseUrl);
  const orderId = `ord-${Date.now()}-${crypto.randomInt(1000, 9999)}`;
  const amount = SUBSCRIPTION_PRICE_UZS;
  const returnUrl = `${baseUrl}/?payment_order=${orderId}`;

  const clickUrl = integrationStatus.clickConfigured
    ? buildClickCheckoutUrl({ orderId, amount, returnUrl })
    : 'https://my.click.uz/';
  const paymeUrl = integrationStatus.paymeConfigured
    ? buildPaymeCheckoutUrl({ orderId, amount, returnUrl })
    : 'https://payme.uz/';

  res.json({
    orderId,
    amount,
    days: SUBSCRIPTION_DAYS,
    integrationStatus,
    links: {
      click: clickUrl,
      payme: paymeUrl,
      uzum: 'https://uzumbank.uz/',
      paynet: 'https://paynet.uz/',
      anorbank: 'https://anorbank.uz/',
      oson: 'https://oson.uz/',
    },
  });
});

app.post('/api/payments/create-order', requireAuth, async (req: AuthedRequest, res) => {
  const provider = String(req.body?.provider || 'click') as PaymentProvider;
  const amount = Number(req.body?.amount || SUBSCRIPTION_PRICE_UZS);
  if (!Number.isFinite(amount) || amount < SUBSCRIPTION_PRICE_UZS) {
    res.status(400).json({
      error: `Minimal to‘lov summasi ${SUBSCRIPTION_PRICE_UZS.toLocaleString()} so‘m.`,
    });
    return;
  }

  const baseUrl = getRequestBaseUrl(req);
  const integrationStatus = getPaymentIntegrationStatus(baseUrl);
  const requestedOrderId = String(req.body?.orderId || '').trim();
  const orderId =
    requestedOrderId.startsWith('ord-') && requestedOrderId.length < 64
      ? requestedOrderId
      : `ord-${Date.now()}-${crypto.randomInt(1000, 9999)}`;
  const returnUrl = `${baseUrl}/?payment_order=${orderId}`;

  let checkoutUrl: string | null = null;
  let mode: PaymentOrder['mode'] = 'demo';

  if (provider === 'click' && integrationStatus.clickConfigured) {
    checkoutUrl = buildClickCheckoutUrl({ orderId, amount, returnUrl });
    mode = 'live_click';
  } else if (provider === 'payme' && integrationStatus.paymeConfigured) {
    checkoutUrl = buildPaymeCheckoutUrl({ orderId, amount, returnUrl });
    mode = 'live_payme';
  } else if (provider === 'click') {
    checkoutUrl = 'https://my.click.uz/';
    mode = 'p2p_manual';
  }

  const state = loadDb();
  let order = state.paymentOrders.find(
    (o) => o.id === orderId && o.userId === req.user!.id
  );
  if (!order) {
    order = {
      id: orderId,
      userId: req.user!.id,
      userName: `${req.user!.firstName} ${req.user!.lastName}`,
      userPhone: req.user!.phone,
      provider,
      amount,
      recipientCard: integrationStatus.recipientCard,
      status: 'pending',
      mode,
      checkoutUrl: checkoutUrl || undefined,
      createdAt: new Date().toISOString(),
    };
    state.paymentOrders.unshift(order);
    await saveDb();
  }

  res.status(201).json({
    order,
    integrationStatus,
    checkoutUrl,
  });
});

app.get('/api/payments/orders/:id', requireAuth, (req: AuthedRequest, res) => {
  const state = loadDb();
  const order = state.paymentOrders.find(
    (o) => o.id === req.params.id && o.userId === req.user!.id
  );
  if (!order) {
    res.status(404).json({ error: 'Buyurtma topilmadi' });
    return;
  }
  const user = state.users.find((u) => u.id === req.user!.id);
  res.json({
    order,
    user: user ? toPublicUser(user) : req.user,
  });
});

// Official Click Merchant Shop API Webhooks (https://docs.click.uz)
app.post('/api/payments/click/prepare', async (req, res) => {
  const {
    click_trans_id = '',
    service_id = '',
    merchant_trans_id = '',
    amount = '',
    action = '',
    sign_time = '',
    sign_string = '',
    error = '0',
  } = req.body || {};

  const valid = verifyClickSignature({
    click_trans_id: String(click_trans_id),
    service_id: String(service_id),
    merchant_trans_id: String(merchant_trans_id),
    amount: String(amount),
    action: String(action),
    sign_time: String(sign_time),
    sign_string: String(sign_string),
  });

  if (!valid) {
    res.json({ error: -1, error_note: 'SIGN CHECK FAILED!' });
    return;
  }

  const state = loadDb();
  const order = state.paymentOrders.find((o) => o.id === String(merchant_trans_id));
  if (!order) {
    res.json({ error: -5, error_note: 'User/order does not exist' });
    return;
  }
  if (Math.abs(Number(amount) - order.amount) > 1) {
    res.json({ error: -2, error_note: 'Incorrect parameter amount' });
    return;
  }
  if (order.status === 'paid') {
    res.json({ error: -4, error_note: 'Already paid' });
    return;
  }
  if (Number(error) < 0) {
    order.status = 'failed';
    await saveDb();
    res.json({ error: -9, error_note: 'Transaction cancelled' });
    return;
  }

  order.externalTransId = String(click_trans_id);
  await saveDb();

  res.json({
    click_trans_id,
    merchant_trans_id,
    merchant_prepare_id: order.id,
    error: 0,
    error_note: 'Success',
  });
});

app.post('/api/payments/click/complete', async (req, res) => {
  const {
    click_trans_id = '',
    service_id = '',
    merchant_trans_id = '',
    merchant_prepare_id = '',
    amount = '',
    action = '',
    sign_time = '',
    sign_string = '',
    error = '0',
  } = req.body || {};

  const valid = verifyClickSignature({
    click_trans_id: String(click_trans_id),
    service_id: String(service_id),
    merchant_trans_id: String(merchant_trans_id),
    merchant_prepare_id: String(merchant_prepare_id),
    amount: String(amount),
    action: String(action),
    sign_time: String(sign_time),
    sign_string: String(sign_string),
  });

  if (!valid) {
    res.json({ error: -1, error_note: 'SIGN CHECK FAILED!' });
    return;
  }

  const state = loadDb();
  const order = state.paymentOrders.find((o) => o.id === String(merchant_trans_id));
  if (!order) {
    res.json({ error: -5, error_note: 'Order does not exist' });
    return;
  }
  if (order.status === 'paid') {
    res.json({ error: -4, error_note: 'Already paid' });
    return;
  }
  if (Number(error) < 0) {
    order.status = 'failed';
    await saveDb();
    res.json({ error: -9, error_note: 'Transaction cancelled' });
    return;
  }

  order.status = 'paid';
  order.mode = 'live_click';
  order.externalTransId = String(click_trans_id);
  order.paidAt = new Date().toISOString();
  activateStudentSubscription(order.userId);
  await saveDb();

  res.json({
    click_trans_id,
    merchant_trans_id,
    merchant_confirm_id: order.id,
    error: 0,
    error_note: 'Success',
  });
});

// ============================================================
// STUDENT CABINET ROUTES
// ============================================================

app.get(
  '/api/student/dashboard',
  requireAuth,
  requireRole('student'),
  requirePaidStudent,
  (req: AuthedRequest, res) => {
    const state = loadDb();
    const student = req.user!;
    const grade = student.grade || 1;
    const subjects = state.subjects.filter(
      (s) => grade >= s.minGrade && grade <= s.maxGrade
    );
    const videos = state.videos.filter((v) => v.grade === grade);
    const ebooks = state.ebooks.filter((b) => b.grade === grade);
    const homeworks = state.homeworks.filter(
      (h) => h.grade === grade && !h.isCanceled
    );
    const submissions = state.submissions.filter(
      (s) => s.studentId === student.id
    );
    const tests = state.tests.filter(
      (t) => t.grade === grade && !t.languageCourseId
    );
    const testResults = state.testResults.filter(
      (r) => r.studentId === student.id
    );
    const notifications = state.notifications.filter(
      (n) => n.userId === student.id
    );

    res.json({
      student,
      subjects,
      videos,
      ebooks,
      homeworks,
      submissions,
      tests,
      testResults,
      notifications,
      languageCourses: state.languageCourses,
    });
  }
);

app.post(
  '/api/student/homework/submit',
  requireAuth,
  requireRole('student'),
  requirePaidStudent,
  async (req: AuthedRequest, res) => {
    const state = loadDb();
    const student = req.user!;
    const homeworkId = String(req.body?.homeworkId || '');
    const answerText = String(req.body?.answerText || '').trim();
    const fileName = req.body?.fileName ? String(req.body.fileName) : '';
    const fileBase64 = req.body?.fileBase64 ? String(req.body.fileBase64) : '';

    const hw = state.homeworks.find(
      (h) => h.id === homeworkId && h.grade === student.grade && !h.isCanceled
    );
    if (!hw) {
      res.status(404).json({ error: 'Uy vazifasi topilmadi' });
      return;
    }
    if (!answerText && !fileBase64) {
      res.status(400).json({ error: 'Matn kiriting yoki fayl/rasm yuklang.' });
      return;
    }

    let attachmentUrl: string | undefined;
    let attachmentType: 'image' | 'pdf' | 'file' | undefined;
    if (fileBase64 && fileName) {
      try {
        const saved = saveBase64Upload(fileName, fileBase64);
        attachmentUrl = saved.url;
        attachmentType = saved.kind;
      } catch (err) {
        res.status(400).json({
          error: err instanceof Error ? err.message : 'Fayl yuklashda xatolik',
        });
        return;
      }
    }

    const existing = state.submissions.find(
      (s) => s.homeworkId === hw.id && s.studentId === student.id
    );
    const nowIso = new Date().toISOString();

    if (existing) {
      existing.answerText = answerText || existing.answerText;
      if (attachmentUrl) {
        existing.attachmentUrl = attachmentUrl;
        existing.attachmentName = fileName;
        existing.attachmentType = attachmentType;
      }
      // Rule: never auto-approve on submission; always pending until teacher reviews
      existing.status = 'pending';
      existing.submittedAt = nowIso;
    } else {
      const sub: HomeworkSubmission = {
        id: `sub-${crypto.randomUUID()}`,
        homeworkId: hw.id,
        studentId: student.id,
        studentName: `${student.firstName} ${student.lastName}`,
        grade: student.grade || hw.grade,
        subjectId: hw.subjectId,
        topic: hw.topic,
        answerText,
        attachmentUrl,
        attachmentName: fileName || undefined,
        attachmentType,
        status: 'pending',
        submittedAt: nowIso,
      };
      state.submissions.unshift(sub);
    }

    // Notify assigned teacher
    state.notifications.unshift({
      id: `notif-${crypto.randomUUID()}`,
      userId: hw.teacherId,
      title: 'Yangi uy vazifasi topshirildi',
      message: `${student.grade}-sinf o‘quvchisi ${student.firstName} ${student.lastName} "${hw.title}" vazifasini topshirdi.`,
      type: 'info',
      read: false,
      createdAt: nowIso,
    });

    await saveDb();
    const resultSub = state.submissions.find(
      (s) => s.homeworkId === hw.id && s.studentId === student.id
    );
    res.status(201).json({ submission: resultSub });
  }
);

app.post(
  '/api/student/tests/:id/submit',
  requireAuth,
  requirePaidStudent,
  async (req: AuthedRequest, res) => {
    const state = loadDb();
    const test = state.tests.find((t) => t.id === req.params.id);
    if (!test) {
      res.status(404).json({ error: 'Test topilmadi' });
      return;
    }
    const answers = Array.isArray(req.body?.answers)
      ? (req.body.answers as number[])
      : [];
    let correctCount = 0;
    test.questions.forEach((q, idx) => {
      if (answers[idx] === q.correctIndex) correctCount++;
    });
    const total = test.questions.length;
    const wrongCount = total - correctCount;
    const percentage = Math.round((correctCount / total) * 100);

    const attempt: TestAttemptResult = {
      id: `res-${crypto.randomUUID()}`,
      testId: test.id,
      testTitle: test.title,
      studentId: req.user!.id,
      studentName: `${req.user!.firstName} ${req.user!.lastName}`,
      grade: req.user!.grade || test.grade,
      subjectId: test.subjectId,
      languageCourseId: test.languageCourseId,
      correctCount,
      wrongCount,
      totalQuestions: total,
      percentage,
      score: percentage,
      answers,
      submittedAt: new Date().toISOString(),
    };
    state.testResults.unshift(attempt);

    // Gamification stars for grades 1-4
    const storedUser = state.users.find((u) => u.id === req.user!.id);
    if (storedUser && storedUser.role === 'student') {
      const earnedStars = Math.max(5, Math.round(percentage / 5));
      storedUser.stars = (storedUser.stars || 0) + earnedStars;
      if (percentage >= 90 && !storedUser.medals?.includes('A’lo testchi')) {
        storedUser.medals = [...(storedUser.medals || []), 'A’lo testchi'];
      }
    }

    if (test.languageCourseId && test.languageLevel) {
      let prog = state.languageProgress.find(
        (p) =>
          p.userId === req.user!.id &&
          p.courseId === test.languageCourseId &&
          p.level === test.languageLevel
      );
      if (!prog) {
        prog = {
          userId: req.user!.id,
          courseId: test.languageCourseId,
          level: test.languageLevel,
          completedSections: ['test'],
          learnedWords: [],
        };
        state.languageProgress.push(prog);
      }
      prog.lastTestPercentage = percentage;
    }

    await saveDb();
    res.status(201).json({
      result: attempt,
      questions: test.questions,
    });
  }
);

app.post('/api/notifications/read-all', requireAuth, async (req: AuthedRequest, res) => {
  const state = loadDb();
  state.notifications.forEach((n) => {
    if (n.userId === req.user!.id) n.read = true;
  });
  await saveDb();
  res.json({ ok: true });
});

// ============================================================
// 12 LANGUAGE COURSES CENTER
// ============================================================

app.get('/api/languages', requireAuth, requirePaidStudent, (req: AuthedRequest, res) => {
  const state = loadDb();
  const tests = state.tests.filter((t) => Boolean(t.languageCourseId));
  const progress = state.languageProgress.filter(
    (p) => p.userId === req.user!.id
  );
  const testResults = state.testResults.filter(
    (r) => r.studentId === req.user!.id && Boolean(r.languageCourseId)
  );
  res.json({
    courses: state.languageCourses,
    tests,
    progress,
    testResults,
  });
});

app.post(
  '/api/languages/:courseId/progress',
  requireAuth,
  requirePaidStudent,
  async (req: AuthedRequest, res) => {
    const state = loadDb();
    const { courseId } = req.params;
    const level = (req.body?.level || 'Beginner') as LanguageLevel;
    const section = req.body?.section ? String(req.body.section) : '';
    const learnedWord = req.body?.learnedWord ? String(req.body.learnedWord) : '';
    const homeworkText = req.body?.homeworkText
      ? String(req.body.homeworkText).trim()
      : '';

    let prog = state.languageProgress.find(
      (p) =>
        p.userId === req.user!.id && p.courseId === courseId && p.level === level
    );
    if (!prog) {
      prog = {
        userId: req.user!.id,
        courseId,
        level,
        completedSections: [],
        learnedWords: [],
      };
      state.languageProgress.push(prog);
    }
    if (section && !prog.completedSections.includes(section)) {
      prog.completedSections.push(section);
    }
    if (learnedWord && !prog.learnedWords.includes(learnedWord)) {
      prog.learnedWords.push(learnedWord);
    }
    if (homeworkText) {
      prog.homeworkText = homeworkText;
      prog.homeworkSubmittedAt = new Date().toISOString();
    }
    await saveDb();
    res.json({ progress: prog });
  }
);

// ============================================================
// TEACHER CABINET ROUTES
// ============================================================

app.get(
  '/api/teacher/dashboard',
  requireAuth,
  requireRole('teacher'),
  (req: AuthedRequest, res) => {
    const state = loadDb();
    const teacher = req.user!;
    const assignedGrades = teacher.assignedGrades?.length
      ? teacher.assignedGrades
      : [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
    const assignedSubjects = teacher.assignedSubjects?.length
      ? teacher.assignedSubjects
      : state.subjects.map((s) => s.id);

    const students = state.users
      .filter(
        (u) => u.role === 'student' && u.grade && assignedGrades.includes(u.grade)
      )
      .map(toPublicUser);
    const studentIds = new Set(students.map((s) => s.id));

    const subjects = state.subjects.filter((s) =>
      assignedSubjects.includes(s.id)
    );
    const homeworks = state.homeworks.filter((h) =>
      assignedGrades.includes(h.grade)
    );
    const submissions = state.submissions.filter(
      (s) => assignedGrades.includes(s.grade) && studentIds.has(s.studentId)
    );
    const tests = state.tests.filter(
      (t) => !t.languageCourseId && assignedGrades.includes(t.grade)
    );
    const testResults = state.testResults.filter(
      (r) => !r.languageCourseId && studentIds.has(r.studentId)
    );
    const notifications = state.notifications.filter(
      (n) => n.userId === teacher.id
    );
    const smsLogs = state.smsLogs.filter((l) => assignedGrades.includes(l.grade));

    res.json({
      teacher,
      assignedGrades,
      subjects,
      allSubjects: state.subjects,
      students,
      homeworks,
      submissions,
      tests,
      testResults,
      notifications,
      smsLogs,
    });
  }
);

app.post(
  '/api/teacher/homeworks',
  requireAuth,
  requireRole('teacher'),
  async (req: AuthedRequest, res) => {
    const state = loadDb();
    const teacher = req.user!;
    const title = String(req.body?.title || '').trim();
    const grade = Number(req.body?.grade);
    const subjectId = String(req.body?.subjectId || '');
    const topic = String(req.body?.topic || '').trim();
    const deadline = String(req.body?.deadline || '');
    const description = String(req.body?.description || '').trim();
    const helpVideoUrl = String(req.body?.helpVideoUrl || '').trim();
    const helpExplanation = String(req.body?.helpExplanation || '').trim();
    const pdfFileName = req.body?.pdfFileName ? String(req.body.pdfFileName) : '';
    const pdfBase64 = req.body?.pdfBase64 ? String(req.body.pdfBase64) : '';
    const imgFileName = req.body?.imgFileName ? String(req.body.imgFileName) : '';
    const imgBase64 = req.body?.imgBase64 ? String(req.body.imgBase64) : '';

    if (!title || !grade || !subjectId || !topic || !deadline) {
      res.status(400).json({ error: 'Vazifa nomi, sinf, fan, mavzu va muddatni kiriting.' });
      return;
    }

    let helpPdfUrl: string | undefined;
    let helpImageUrl: string | undefined;
    try {
      if (pdfBase64 && pdfFileName) {
        helpPdfUrl = saveBase64Upload(pdfFileName, pdfBase64).url;
      }
      if (imgBase64 && imgFileName) {
        helpImageUrl = saveBase64Upload(imgFileName, imgBase64).url;
      }
    } catch (err) {
      res.status(400).json({
        error: err instanceof Error ? err.message : 'Fayl saqlashda xatolik',
      });
      return;
    }

    const hw: HomeworkAssignment = {
      id: `hw-${crypto.randomUUID()}`,
      title,
      grade,
      subjectId,
      topic,
      deadline: new Date(deadline).toISOString(),
      description,
      helpVideoUrl: helpVideoUrl || undefined,
      helpPdfUrl,
      helpImageUrl,
      helpExplanation:
        helpExplanation || 'Darslikdagi asosiy qoidalarni takrorlab, bosqichma-bosqich bajaring.',
      teacherId: teacher.id,
      teacherName: `${teacher.firstName} ${teacher.lastName}`,
      createdAt: new Date().toISOString(),
    };
    state.homeworks.unshift(hw);

    // Notify all students of that grade
    const nowIso = new Date().toISOString();
    state.users
      .filter((u) => u.role === 'student' && u.grade === grade)
      .forEach((stu) => {
        state.notifications.unshift({
          id: `notif-${crypto.randomUUID()}`,
          userId: stu.id,
          title: 'Yangi uy vazifasi',
          message: `${teacher.firstName} ${teacher.lastName}: "${title}" (${topic})`,
          type: 'info',
          read: false,
          createdAt: nowIso,
        });
      });

    await saveDb();
    res.status(201).json({ homework: hw });
  }
);

app.patch(
  '/api/teacher/submissions/:id',
  requireAuth,
  requireRole('teacher'),
  async (req: AuthedRequest, res) => {
    const state = loadDb();
    const sub = state.submissions.find((s) => s.id === req.params.id);
    if (!sub) {
      res.status(404).json({ error: 'Topshirilgan ish topilmadi' });
      return;
    }
    const status = String(req.body?.status || '') as HomeworkSubmission['status'];
    if (!['pending', 'approved', 'revision'].includes(status)) {
      res.status(400).json({ error: 'Noto‘g‘ri vazifa holati' });
      return;
    }
    const mark5 = Number(req.body?.mark5 || (status === 'approved' ? 5 : 2));
    const score = Number(
      req.body?.score ??
        (mark5 === 5 ? 95 : mark5 === 4 ? 82 : mark5 === 3 ? 68 : 45)
    );
    const teacherComment = String(req.body?.teacherComment || '').trim();

    sub.status = status;
    sub.mark5 = mark5;
    sub.score = score;
    sub.teacherComment = teacherComment;
    sub.reviewedAt = new Date().toISOString();
    sub.reviewedBy = `${req.user!.firstName} ${req.user!.lastName}`;

    // Award stars for grades 1-4 if approved
    const stu = state.users.find((u) => u.id === sub.studentId);
    if (stu && status === 'approved' && (stu.grade || 5) <= 4) {
      stu.stars = (stu.stars || 0) + 15;
    }

    state.notifications.unshift({
      id: `notif-${crypto.randomUUID()}`,
      userId: sub.studentId,
      title:
        status === 'approved'
          ? 'Vazifa qabul qilindi ✓'
          : 'Vazifani qayta ishlash kerak',
      message: `${sub.topic} — Baho: ${mark5} (${score}%). ${teacherComment}`,
      type: status === 'approved' ? 'success' : 'warning',
      read: false,
      createdAt: new Date().toISOString(),
    });

    await saveDb();
    res.json({ submission: sub });
  }
);

app.post(
  '/api/teacher/tests',
  requireAuth,
  requireRole('teacher'),
  async (req: AuthedRequest, res) => {
    const title = String(req.body?.title || '').trim();
    const grade = Number(req.body?.grade);
    const subjectId = String(req.body?.subjectId || '');
    const durationMinutes = Number(req.body?.durationMinutes || 25);
    const questions = Array.isArray(req.body?.questions)
      ? (req.body.questions as TestQuestion[])
      : [];

    if (!title || !grade || !subjectId) {
      res.status(400).json({ error: 'Test nomi, sinf va fanni kiriting.' });
      return;
    }
    if (questions.length !== 20) {
      res.status(400).json({
        error: `Har bir test aynan 20 ta savoldan iborat bo‘lishi shart (hozir: ${questions.length}).`,
      });
      return;
    }
    for (let i = 0; i < 20; i++) {
      const q = questions[i];
      if (!q?.question?.trim() || !Array.isArray(q.options) || q.options.some((o) => !String(o).trim())) {
        res.status(400).json({
          error: `${i + 1}-savol matni va barcha 4 ta javob variantini to‘ldiring.`,
        });
        return;
      }
    }

    const state = loadDb();
    const test: SchoolTest = {
      id: `test-${crypto.randomUUID()}`,
      title,
      grade,
      subjectId,
      durationMinutes,
      questions: questions.map((q, idx) => ({
        id: `tq-${Date.now()}-${idx + 1}`,
        question: q.question.trim(),
        options: [
          q.options[0].trim(),
          q.options[1].trim(),
          q.options[2].trim(),
          q.options[3].trim(),
        ],
        correctIndex: q.correctIndex,
        explanation: q.explanation?.trim() || 'To‘g‘ri javob o‘qituvchi tomonidan belgilandi.',
      })),
      teacherId: req.user!.id,
      createdAt: new Date().toISOString(),
    };

    state.tests.unshift(test);
    await saveDb();
    res.status(201).json({ test });
  }
);

app.post(
  '/api/teacher/sms/send-overdue',
  requireAuth,
  requireRole('teacher'),
  async (req: AuthedRequest, res) => {
    const homeworkId = req.body?.homeworkId
      ? String(req.body.homeworkId)
      : undefined;
    const includeParents = Boolean(req.body?.includeParents);
    const created = await runOverdueSmsScheduler({
      homeworkId,
      includeParents,
    });
    res.json({ created, count: created.length });
  }
);

// ============================================================
// ADMIN CABINET ROUTES
// ============================================================

app.get(
  '/api/admin/dashboard',
  requireAuth,
  requireRole('admin'),
  (req: AuthedRequest, res) => {
    const state = loadDb();
    res.json({
      admin: req.user,
      users: state.users.map(toPublicUser),
      subjects: state.subjects,
      videos: state.videos,
      ebooks: state.ebooks,
      homeworks: state.homeworks,
      submissions: state.submissions,
      tests: state.tests,
      testResults: state.testResults,
      payments: state.paymentOrders,
      smsLogs: state.smsLogs,
      languageCourses: state.languageCourses,
      integrationStatus: getPaymentIntegrationStatus(getRequestBaseUrl(req)),
    });
  }
);

app.post(
  '/api/admin/teachers',
  requireAuth,
  requireRole('admin'),
  async (req: AuthedRequest, res) => {
    const state = loadDb();
    const firstName = String(req.body?.firstName || '').trim();
    const lastName = String(req.body?.lastName || '').trim();
    const phone = normalizePhone(String(req.body?.phone || ''));
    const email = String(req.body?.email || '').trim();
    const password = String(req.body?.password || 'teacher348');
    const assignedGrades = Array.isArray(req.body?.assignedGrades)
      ? (req.body.assignedGrades as number[])
      : [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
    const assignedSubjects = Array.isArray(req.body?.assignedSubjects)
      ? (req.body.assignedSubjects as string[])
      : ['math'];

    if (!firstName || !lastName || !phone) {
      res.status(400).json({ error: 'Ism, familiya va telefon raqamini kiriting.' });
      return;
    }
    if (state.users.some((u) => u.phone === phone)) {
      res.status(409).json({ error: 'Bu raqam allaqachon ro‘yxatda bor.' });
      return;
    }

    const teacher = {
      id: `user-${crypto.randomUUID()}`,
      role: 'teacher' as const,
      firstName,
      lastName,
      phone,
      email,
      assignedGrades,
      assignedSubjects,
      approved: true,
      faceVerified: true,
      passwordHash: hashPassword(password),
      createdAt: new Date().toISOString(),
    };
    state.users.push(teacher);
    await saveDb();
    res.status(201).json({ teacher: toPublicUser(teacher) });
  }
);

app.patch(
  '/api/admin/teachers/:id',
  requireAuth,
  requireRole('admin'),
  async (req: AuthedRequest, res) => {
    const state = loadDb();
    const teacher = state.users.find(
      (u) => u.id === req.params.id && u.role === 'teacher'
    );
    if (!teacher) {
      res.status(404).json({ error: 'O‘qituvchi topilmadi' });
      return;
    }
    if (typeof req.body?.approved === 'boolean') {
      teacher.approved = req.body.approved;
    }
    if (Array.isArray(req.body?.assignedGrades)) {
      teacher.assignedGrades = req.body.assignedGrades.map(Number);
    }
    if (Array.isArray(req.body?.assignedSubjects)) {
      teacher.assignedSubjects = req.body.assignedSubjects.map(String);
    }
    await saveDb();
    res.json({ teacher: toPublicUser(teacher) });
  }
);

app.patch(
  '/api/admin/students/:id/subscription',
  requireAuth,
  requireRole('admin'),
  async (req: AuthedRequest, res) => {
    const state = loadDb();
    const student = state.users.find(
      (u) => u.id === req.params.id && u.role === 'student'
    );
    if (!student) {
      res.status(404).json({ error: 'O‘quvchi topilmadi' });
      return;
    }
    const active = Boolean(req.body?.active);
    if (active) {
      activateStudentSubscription(student.id);
    } else {
      student.subscriptionExpiresAt = new Date(Date.now() - 3600 * 1000).toISOString();
    }
    await saveDb();
    res.json({ student: toPublicUser(student) });
  }
);

app.post(
  '/api/admin/videos',
  requireAuth,
  requireRole('admin'),
  async (req: AuthedRequest, res) => {
    const state = loadDb();
    const title = String(req.body?.title || '').trim();
    const grade = Number(req.body?.grade);
    const subjectId = String(req.body?.subjectId || '');
    const topic = String(req.body?.topic || '').trim();
    const durationMinutes = Number(req.body?.durationMinutes || 15);
    const notes = String(req.body?.notes || '').trim();
    let videoUrl = String(req.body?.videoUrl || '').trim();

    if (req.body?.videoBase64 && req.body?.videoFileName) {
      videoUrl = saveBase64Upload(
        String(req.body.videoFileName),
        String(req.body.videoBase64)
      ).url;
    }

    if (!title || !grade || !subjectId || !videoUrl) {
      res.status(400).json({ error: 'Video nomi, sinf, fan va havola/faylni kiriting.' });
      return;
    }

    const video = {
      id: `vid-${crypto.randomUUID()}`,
      title,
      grade,
      subjectId,
      topic: topic || title,
      durationMinutes,
      videoUrl,
      notes: notes || 'Administrator tomonidan qo‘shilgan video dars.',
      teacherName: '348-MAKTAB',
      createdAt: new Date().toISOString(),
    };
    state.videos.unshift(video);
    await saveDb();
    res.status(201).json({ video });
  }
);

app.post(
  '/api/admin/ebooks',
  requireAuth,
  requireRole('admin'),
  async (req: AuthedRequest, res) => {
    const state = loadDb();
    const title = String(req.body?.title || '').trim();
    const grade = Number(req.body?.grade);
    const subjectId = String(req.body?.subjectId || '');
    const author = String(req.body?.author || '348-MAKTAB').trim();
    const summary = String(req.body?.summary || '').trim();

    if (!title || !grade || !subjectId) {
      res.status(400).json({ error: 'Kitob nomi, sinf va fanni kiriting.' });
      return;
    }

    let uploadedFileUrl: string | undefined;
    if (req.body?.pdfBase64 && req.body?.pdfFileName) {
      uploadedFileUrl = saveBase64Upload(
        String(req.body.pdfFileName),
        String(req.body.pdfBase64)
      ).url;
    }

    const id = `ebook-${crypto.randomUUID()}`;
    const ebook = {
      id,
      title,
      grade,
      subjectId,
      author,
      pagesCount: Number(req.body?.pagesCount || 140),
      summary: summary || `${grade}-sinf uchun elektron darslik.`,
      chapters: [
        {
          title: 'Kirish va asosiy mavzular',
          content: summary || `${title} — ${grade}-sinf o‘quv qo‘llanmasi.`,
        },
      ],
      pdfUrl: `/api/ebooks/${id}/pdf`,
      uploadedFileUrl,
      createdAt: new Date().toISOString(),
    };
    state.ebooks.unshift(ebook);
    await saveDb();
    res.status(201).json({ ebook });
  }
);

app.patch(
  '/api/admin/languages/:courseId/:level/video',
  requireAuth,
  requireRole('admin'),
  async (req: AuthedRequest, res) => {
    const state = loadDb();
    const course = state.languageCourses.find((c) => c.id === req.params.courseId);
    const level = req.params.level as LanguageLevel;
    if (!course || !course.levels[level]) {
      res.status(404).json({ error: 'Til kursi yoki daraja topilmadi' });
      return;
    }

    let videoUrl = String(req.body?.videoUrl || '').trim();
    if (req.body?.videoBase64 && req.body?.videoFileName) {
      videoUrl = saveBase64Upload(
        String(req.body.videoFileName),
        String(req.body.videoBase64)
      ).url;
    }
    if (!videoUrl) {
      res.status(400).json({ error: 'Video havola yoki faylni kiriting.' });
      return;
    }
    course.levels[level].videoUrl = videoUrl;
    if (req.body?.videoTitle) {
      course.levels[level].videoTitle = String(req.body.videoTitle);
    }
    await saveDb();
    res.json({ course });
  }
);

app.patch(
  '/api/admin/payments/:orderId/verify',
  requireAuth,
  requireRole('admin'),
  async (req: AuthedRequest, res) => {
    const state = loadDb();
    const order = state.paymentOrders.find((o) => o.id === req.params.orderId);
    if (!order) {
      res.status(404).json({ error: 'To‘lov topilmadi' });
      return;
    }
    const approve = Boolean(req.body?.approve);
    if (approve) {
      order.status = 'paid';
      order.paidAt = new Date().toISOString();
      activateStudentSubscription(order.userId);
    } else {
      order.status = 'failed';
    }
    await saveDb();
    res.json({ order });
  }
);

app.post(
  '/api/admin/sms/run-scheduler',
  requireAuth,
  requireRole('admin'),
  async (req: AuthedRequest, res) => {
    const includeParents = Boolean(req.body?.includeParents);
    const created = await runOverdueSmsScheduler({ includeParents });
    res.json({ created, count: created.length });
  }
);

// Background overdue SMS scheduler (checks every 60s without blocking startup)
setInterval(() => {
  runOverdueSmsScheduler({ includeParents: true }).catch(() => {});
}, 60_000);

app.use(
  '/api',
  (
    err: unknown,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction
  ) => {
    const status =
      typeof (err as { status?: unknown })?.status === 'number'
        ? (err as { status: number }).status
        : 500;
    const message =
      err instanceof Error
        ? err.message
        : 'Serverda kutilmagan xatolik yuz berdi.';
    res.status(status).json({ error: message });
  }
);

// ============================================================
// VITE / STATIC SERVING
// ============================================================

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`348-MAKTAB server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
