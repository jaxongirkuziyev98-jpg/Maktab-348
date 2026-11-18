export type Lang = 'uz' | 'ru' | 'en';
export type ThemeMode = 'light' | 'dark';
export type UserRole = 'student' | 'teacher' | 'admin';

export type HomeworkStatus = 'pending' | 'approved' | 'revision';

export type PaymentProvider =
  | 'click'
  | 'payme'
  | 'uzum'
  | 'paynet'
  | 'anorbank'
  | 'oson';

export type LanguageLevel = 'Beginner' | 'Intermediate' | 'Advanced';

export interface UserProfile {
  id: string;
  role: UserRole;
  firstName: string;
  lastName: string;
  phone: string;
  parentPhone?: string;
  email?: string;
  grade?: number; // 1-11 for students
  assignedGrades?: number[]; // for teachers
  assignedSubjects?: string[]; // subject IDs for teachers
  faceVerified?: boolean;
  avatarUrl?: string; // circular photo ONLY for teachers
  approved: boolean;
  subscriptionExpiresAt?: string | null; // ISO timestamp for students
  stars?: number; // gamification for grades 1-4
  medals?: string[];
  createdAt: string;
}

export interface SubjectInfo {
  id: string;
  nameUz: string;
  nameRu: string;
  nameEn: string;
  minGrade: number;
  maxGrade: number;
  category: 'stem' | 'humanities' | 'languages' | 'tech' | 'civic';
}

export interface VideoLesson {
  id: string;
  title: string;
  subjectId: string;
  grade: number;
  topic: string;
  durationMinutes: number;
  videoUrl: string;
  notes: string;
  teacherName?: string;
  createdAt: string;
}

export interface Ebook {
  id: string;
  title: string;
  subjectId: string;
  grade: number;
  author: string;
  pagesCount: number;
  summary: string;
  chapters: { title: string; content: string }[];
  pdfUrl: string;
  uploadedFileUrl?: string;
  createdAt: string;
}

export interface HomeworkAssignment {
  id: string;
  title: string;
  grade: number;
  subjectId: string;
  topic: string;
  deadline: string; // ISO
  description: string;
  helpVideoUrl?: string;
  helpPdfUrl?: string;
  helpImageUrl?: string;
  helpExplanation: string;
  teacherId: string;
  teacherName: string;
  isCanceled?: boolean;
  createdAt: string;
}

export interface HomeworkSubmission {
  id: string;
  homeworkId: string;
  studentId: string;
  studentName: string;
  grade: number;
  subjectId: string;
  topic: string;
  answerText: string;
  attachmentUrl?: string;
  attachmentName?: string;
  attachmentType?: 'image' | 'pdf' | 'file';
  status: HomeworkStatus;
  score?: number; // 2-5 or 0-100
  mark5?: number; // 2 | 3 | 4 | 5
  teacherComment?: string;
  submittedAt: string;
  reviewedAt?: string;
  reviewedBy?: string;
}

export interface TestQuestion {
  id: string;
  question: string;
  options: [string, string, string, string]; // A, B, C, D
  correctIndex: 0 | 1 | 2 | 3;
  explanation: string;
}

export interface SchoolTest {
  id: string;
  title: string;
  grade: number;
  subjectId: string;
  languageCourseId?: string;
  languageLevel?: LanguageLevel;
  durationMinutes: number;
  questions: TestQuestion[]; // strictly 20 questions
  teacherId: string;
  createdAt: string;
}

export interface TestAttemptResult {
  id: string;
  testId: string;
  testTitle: string;
  studentId: string;
  studentName: string;
  grade: number;
  subjectId: string;
  languageCourseId?: string;
  correctCount: number;
  wrongCount: number;
  totalQuestions: number;
  percentage: number;
  score: number;
  answers: number[];
  submittedAt: string;
}

export interface NotificationItem {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning';
  read: boolean;
  createdAt: string;
}

export interface SmsLogItem {
  id: string;
  homeworkId: string;
  homeworkTitle: string;
  subjectId: string;
  grade: number;
  studentId: string;
  studentName: string;
  target: 'student' | 'parent';
  phone: string;
  message: string;
  status: 'sent' | 'demo_logged' | 'failed';
  sentAt: string;
}

export interface PaymentOrder {
  id: string;
  userId: string;
  userName: string;
  userPhone: string;
  provider: PaymentProvider;
  amount: number;
  recipientCard: string;
  status: 'pending' | 'pending_verification' | 'paid' | 'failed';
  mode: 'live_click' | 'live_payme' | 'p2p_manual' | 'demo';
  externalTransId?: string;
  receiptNote?: string;
  checkoutUrl?: string;
  createdAt: string;
  paidAt?: string;
}

export interface IntegrationStatus {
  clickConfigured: boolean;
  paymeConfigured: boolean;
  smsConfigured: boolean;
  recipientCard: string;
  subscriptionPriceUzs: number;
  subscriptionDays: number;
  webhookUrls: {
    clickPrepare: string;
    clickComplete: string;
  };
}

export interface VocabItem {
  word: string;
  phonetic: string;
  translationUz: string;
  translationRu: string;
  translationEn: string;
  example: string;
}

export interface LanguageLevelContent {
  level: LanguageLevel;
  videoUrl: string;
  videoTitle: string;
  grammarTitle: string;
  grammarRules: string[];
  vocabulary: VocabItem[];
  listeningScript: string;
  listeningQuestion: string;
  listeningOptions: [string, string, string, string];
  listeningCorrectIndex: number;
  speakingPrompt: string;
  speakingSample: string;
  readingTitle: string;
  readingPassage: string;
  readingQuestion: string;
  readingOptions: [string, string, string, string];
  readingCorrectIndex: number;
  homeworkPrompt: string;
}

export interface LanguageCourse {
  id: string;
  nameUz: string;
  nameRu: string;
  nameEn: string;
  nativeName: string;
  speechLang: string;
  code: string;
  levels: Record<LanguageLevel, LanguageLevelContent>;
}

export interface LanguageProgress {
  userId: string;
  courseId: string;
  level: LanguageLevel;
  completedSections: string[];
  learnedWords: string[];
  homeworkText?: string;
  homeworkSubmittedAt?: string;
  lastTestPercentage?: number;
}
