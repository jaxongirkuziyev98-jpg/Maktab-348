import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type {
  Ebook,
  HomeworkAssignment,
  HomeworkSubmission,
  LanguageCourse,
  LanguageProgress,
  NotificationItem,
  PaymentOrder,
  SmsLogItem,
  SchoolTest,
  SubjectInfo,
  TestAttemptResult,
  UserProfile,
  VideoLesson,
} from '../src/types/lms.ts';
import {
  SCHOOL_SUBJECTS,
  createSeedEbooks,
  createSeedHomeworks,
  createSeedLanguageCourses,
  createSeedLanguageTests,
  createSeedNotifications,
  createSeedSubmissions,
  createSeedTestResults,
  createSeedTests,
  createSeedUsers,
  createSeedVideos,
  type StoredUser,
} from './seed.ts';

export interface DatabaseState {
  users: StoredUser[];
  subjects: SubjectInfo[];
  videos: VideoLesson[];
  ebooks: Ebook[];
  homeworks: HomeworkAssignment[];
  submissions: HomeworkSubmission[];
  tests: SchoolTest[];
  testResults: TestAttemptResult[];
  notifications: NotificationItem[];
  smsLogs: SmsLogItem[];
  paymentOrders: PaymentOrder[];
  languageCourses: LanguageCourse[];
  languageProgress: LanguageProgress[];
}

const DATA_DIR = path.resolve(process.cwd(), 'data');
export const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');
const DB_PATH = path.join(DATA_DIR, 'db.json');

function ensureDirs(): void {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

function buildInitialDb(): DatabaseState {
  return {
    users: createSeedUsers(),
    subjects: SCHOOL_SUBJECTS,
    videos: createSeedVideos(),
    ebooks: createSeedEbooks(),
    homeworks: createSeedHomeworks(),
    submissions: createSeedSubmissions(),
    tests: [...createSeedTests(), ...createSeedLanguageTests()],
    testResults: createSeedTestResults(),
    notifications: createSeedNotifications(),
    smsLogs: [],
    paymentOrders: [],
    languageCourses: createSeedLanguageCourses(),
    languageProgress: [],
  };
}

let dbState: DatabaseState | null = null;
let writeQueue: Promise<void> = Promise.resolve();

export function loadDb(): DatabaseState {
  if (dbState) return dbState;
  ensureDirs();
  if (!fs.existsSync(DB_PATH)) {
    dbState = buildInitialDb();
    fs.writeFileSync(DB_PATH, JSON.stringify(dbState, null, 2), 'utf8');
    return dbState;
  }
  try {
    const raw = fs.readFileSync(DB_PATH, 'utf8');
    const parsed = JSON.parse(raw) as Partial<DatabaseState>;
    const fresh = buildInitialDb();
    dbState = {
      users: parsed.users?.length ? parsed.users : fresh.users,
      subjects: SCHOOL_SUBJECTS,
      videos: parsed.videos?.length ? parsed.videos : fresh.videos,
      ebooks: parsed.ebooks?.length ? parsed.ebooks : fresh.ebooks,
      homeworks: parsed.homeworks?.length ? parsed.homeworks : fresh.homeworks,
      submissions: parsed.submissions || fresh.submissions,
      tests: parsed.tests?.length ? parsed.tests : fresh.tests,
      testResults: parsed.testResults || fresh.testResults,
      notifications: parsed.notifications || fresh.notifications,
      smsLogs: parsed.smsLogs || [],
      paymentOrders: parsed.paymentOrders || [],
      languageCourses: parsed.languageCourses?.length
        ? parsed.languageCourses
        : fresh.languageCourses,
      languageProgress: parsed.languageProgress || [],
    };
    return dbState;
  } catch {
    dbState = buildInitialDb();
    fs.writeFileSync(DB_PATH, JSON.stringify(dbState, null, 2), 'utf8');
    return dbState;
  }
}

export function saveDb(): Promise<void> {
  const snapshot = JSON.stringify(loadDb(), null, 2);
  writeQueue = writeQueue.then(async () => {
    ensureDirs();
    const tmpPath = `${DB_PATH}.${process.pid}.tmp`;
    fs.writeFileSync(tmpPath, snapshot, 'utf8');
    fs.renameSync(tmpPath, DB_PATH);
  });
  return writeQueue;
}

export function toPublicUser(user: StoredUser): UserProfile {
  const { passwordHash: _ignored, ...rest } = user;
  return rest;
}

const ALLOWED_EXTS = new Set([
  '.pdf',
  '.png',
  '.jpg',
  '.jpeg',
  '.webp',
  '.gif',
  '.mp4',
  '.webm',
  '.txt',
  '.doc',
  '.docx',
]);

export function saveBase64Upload(
  fileName: string,
  base64Data: string
): { url: string; storedName: string; kind: 'image' | 'pdf' | 'file' } {
  ensureDirs();
  const cleanData = base64Data.includes(',')
    ? base64Data.split(',')[1]
    : base64Data;
  const buf = Buffer.from(cleanData, 'base64');
  if (buf.length > 12 * 1024 * 1024) {
    throw new Error('Fayl hajmi 12 MB dan oshmasligi kerak');
  }
  const rawExt = path.extname(fileName || '').toLowerCase();
  const ext = ALLOWED_EXTS.has(rawExt) ? rawExt : '.bin';
  if (ext === '.bin') {
    throw new Error('Ruxsat etilmagan fayl turi');
  }
  const storedName = `${crypto.randomUUID()}${ext}`;
  const fullPath = path.join(UPLOADS_DIR, storedName);
  fs.writeFileSync(fullPath, buf);

  const kind: 'image' | 'pdf' | 'file' =
    ext === '.pdf'
      ? 'pdf'
      : ['.png', '.jpg', '.jpeg', '.webp', '.gif'].includes(ext)
      ? 'image'
      : 'file';

  return {
    url: `/api/uploads/${storedName}`,
    storedName,
    kind,
  };
}
