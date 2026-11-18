import crypto from 'node:crypto';
import type { IntegrationStatus, SmsLogItem } from '../src/types/lms.ts';
import { SCHOOL_SUBJECTS } from './seed.ts';
import { loadDb, saveDb } from './store.ts';

export const SUBSCRIPTION_PRICE_UZS = 10000;
export const SUBSCRIPTION_DAYS = 30;
export const DEFAULT_RECIPIENT_CARD =
  process.env.RECIPIENT_CARD_NUMBER || '5614682014970760';

export function getPaymentIntegrationStatus(baseUrl = ''): IntegrationStatus {
  const clickConfigured = Boolean(
    process.env.CLICK_SERVICE_ID &&
      process.env.CLICK_MERCHANT_ID &&
      process.env.CLICK_SECRET_KEY
  );
  const paymeConfigured = Boolean(
    process.env.PAYME_MERCHANT_ID && process.env.PAYME_KEY
  );
  const smsConfigured = Boolean(
    (process.env.SMS_GATEWAY_URL && process.env.SMS_GATEWAY_TOKEN) ||
      (process.env.SMS_ESKIZ_EMAIL && process.env.SMS_ESKIZ_PASSWORD)
  );

  const cleanBase = baseUrl.replace(/\/$/, '');
  return {
    clickConfigured,
    paymeConfigured,
    smsConfigured,
    recipientCard: DEFAULT_RECIPIENT_CARD,
    subscriptionPriceUzs: SUBSCRIPTION_PRICE_UZS,
    subscriptionDays: SUBSCRIPTION_DAYS,
    webhookUrls: {
      clickPrepare: `${cleanBase}/api/payments/click/prepare`,
      clickComplete: `${cleanBase}/api/payments/click/complete`,
    },
  };
}

export function buildClickCheckoutUrl(params: {
  orderId: string;
  amount: number;
  returnUrl: string;
}): string | null {
  const serviceId = process.env.CLICK_SERVICE_ID;
  const merchantId = process.env.CLICK_MERCHANT_ID;
  if (!serviceId || !merchantId) return null;

  const qs = new URLSearchParams({
    service_id: serviceId,
    merchant_id: merchantId,
    amount: String(params.amount),
    transaction_param: params.orderId,
    return_url: params.returnUrl,
  });
  if (process.env.CLICK_MERCHANT_USER_ID) {
    qs.set('merchant_user_id', process.env.CLICK_MERCHANT_USER_ID);
  }
  return `https://my.click.uz/services/pay?${qs.toString()}`;
}

export function buildPaymeCheckoutUrl(params: {
  orderId: string;
  amount: number;
  returnUrl: string;
}): string | null {
  const merchantId = process.env.PAYME_MERCHANT_ID;
  if (!merchantId) return null;
  const amountTiyin = Math.round(params.amount * 100);
  const payload = `m=${merchantId};ac.order_id=${params.orderId};a=${amountTiyin};c=${params.returnUrl}`;
  const encoded = Buffer.from(payload, 'utf8').toString('base64');
  return `https://checkout.paycom.uz/${encoded}`;
}

export function verifyClickSignature(input: {
  click_trans_id: string;
  service_id: string;
  merchant_trans_id: string;
  merchant_prepare_id?: string;
  amount: string;
  action: string;
  sign_time: string;
  sign_string: string;
}): boolean {
  const secretKey = process.env.CLICK_SECRET_KEY;
  if (!secretKey) return false;
  const raw =
    input.action === '1'
      ? `${input.click_trans_id}${input.service_id}${secretKey}${input.merchant_trans_id}${input.merchant_prepare_id || ''}${input.amount}${input.action}${input.sign_time}`
      : `${input.click_trans_id}${input.service_id}${secretKey}${input.merchant_trans_id}${input.amount}${input.action}${input.sign_time}`;
  const expected = crypto.createHash('md5').update(raw).digest('hex');
  return expected.toLowerCase() === (input.sign_string || '').toLowerCase();
}

let cachedEskizToken: { token: string; fetchedAt: number } | null = null;

async function getEskizToken(): Promise<string | null> {
  if (
    cachedEskizToken &&
    Date.now() - cachedEskizToken.fetchedAt < 12 * 3600 * 1000
  ) {
    return cachedEskizToken.token;
  }
  const email = process.env.SMS_ESKIZ_EMAIL;
  const password = process.env.SMS_ESKIZ_PASSWORD;
  if (!email || !password) return null;

  try {
    const resp = await fetch('https://notify.eskiz.uz/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (!resp.ok) return null;
    const data = (await resp.json()) as { data?: { token?: string } };
    if (data?.data?.token) {
      cachedEskizToken = { token: data.data.token, fetchedAt: Date.now() };
      return data.data.token;
    }
    return null;
  } catch {
    return null;
  }
}

export async function dispatchSms(
  phone: string,
  message: string
): Promise<'sent' | 'demo_logged' | 'failed'> {
  const customUrl = process.env.SMS_GATEWAY_URL;
  const customToken = process.env.SMS_GATEWAY_TOKEN;

  if (customUrl && customToken) {
    try {
      const resp = await fetch(customUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${customToken}`,
        },
        body: JSON.stringify({
          mobile_phone: phone.replace(/\D/g, ''),
          message,
          from: '4546',
        }),
      });
      return resp.ok ? 'sent' : 'failed';
    } catch {
      return 'failed';
    }
  }

  if (process.env.SMS_ESKIZ_EMAIL && process.env.SMS_ESKIZ_PASSWORD) {
    try {
      const token = await getEskizToken();
      if (!token) return 'failed';
      const resp = await fetch('https://notify.eskiz.uz/api/message/sms/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          mobile_phone: phone.replace(/\D/g, ''),
          message,
          from: '4546',
        }),
      });
      return resp.ok ? 'sent' : 'failed';
    } catch {
      return 'failed';
    }
  }

  return 'demo_logged';
}

export function formatOverdueSmsMessage(params: {
  studentName: string;
  grade: number;
  subjectName: string;
  homeworkTitle: string;
}): string {
  return `Assalomu alaykum! Hurmatli ${params.studentName}, siz ${params.grade}-sinf o‘quvchisisiz. Sizda ${params.subjectName} fanidan '${params.homeworkTitle}' uyga vazifasi bajarilmagan. Iltimos, 348-MAKTAB platformasiga kirib, uyga vazifangizni bajaring.`;
}

export async function runOverdueSmsScheduler(options?: {
  includeParents?: boolean;
  homeworkId?: string;
}): Promise<SmsLogItem[]> {
  const db = loadDb();
  const now = Date.now();
  const created: SmsLogItem[] = [];

  for (const hw of db.homeworks) {
    if (hw.isCanceled) continue; // Rule: no SMS for canceled homework
    if (options?.homeworkId && hw.id !== options.homeworkId) continue;
    if (new Date(hw.deadline).getTime() > now) continue; // Only overdue

    const subj = SCHOOL_SUBJECTS.find((s) => s.id === hw.subjectId);
    const subjectName = subj?.nameUz || hw.subjectId;
    const studentsInGrade = db.users.filter(
      (u) => u.role === 'student' && u.grade === hw.grade
    );

    for (const student of studentsInGrade) {
      // Rule: do not send if student already submitted (pending/approved/revision)
      const submitted = db.submissions.some(
        (s) => s.homeworkId === hw.id && s.studentId === student.id
      );
      if (submitted) continue;

      const fullName = `${student.firstName} ${student.lastName}`;
      const message = formatOverdueSmsMessage({
        studentName: fullName,
        grade: student.grade || hw.grade,
        subjectName,
        homeworkTitle: hw.title,
      });

      // Rule: never duplicate SMS for same homework + student
      const alreadySentStudent = db.smsLogs.some(
        (log) =>
          log.homeworkId === hw.id &&
          log.studentId === student.id &&
          log.target === 'student'
      );

      if (!alreadySentStudent && student.phone) {
        const status = await dispatchSms(student.phone, message);
        const logItem: SmsLogItem = {
          id: `sms-${crypto.randomUUID()}`,
          homeworkId: hw.id,
          homeworkTitle: hw.title,
          subjectId: hw.subjectId,
          grade: hw.grade,
          studentId: student.id,
          studentName: fullName,
          target: 'student',
          phone: student.phone,
          message,
          status,
          sentAt: new Date().toISOString(),
        };
        db.smsLogs.unshift(logItem);
        created.push(logItem);
      }

      if (options?.includeParents && student.parentPhone) {
        const alreadySentParent = db.smsLogs.some(
          (log) =>
            log.homeworkId === hw.id &&
            log.studentId === student.id &&
            log.target === 'parent'
        );
        if (!alreadySentParent) {
          const parentMessage = `Ota-ona xabarnomasi: ${message}`;
          const status = await dispatchSms(student.parentPhone, parentMessage);
          const logItem: SmsLogItem = {
            id: `sms-${crypto.randomUUID()}`,
            homeworkId: hw.id,
            homeworkTitle: hw.title,
            subjectId: hw.subjectId,
            grade: hw.grade,
            studentId: student.id,
            studentName: fullName,
            target: 'parent',
            phone: student.parentPhone,
            message: parentMessage,
            status,
            sentAt: new Date().toISOString(),
          };
          db.smsLogs.unshift(logItem);
          created.push(logItem);
        }
      }
    }
  }

  if (created.length > 0) {
    await saveDb();
  }
  return created;
}
