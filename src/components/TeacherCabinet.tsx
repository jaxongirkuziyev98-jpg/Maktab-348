import { useCallback, useEffect, useState } from 'react';
import {
  BarChart3,
  Bell,
  CheckCircle2,
  ClipboardList,
  Clock,
  FilePlus2,
  Inbox,
  LogOut,
  MessageSquare,
  PlusCircle,
  Send,
  Upload,
  User as UserIcon,
} from 'lucide-react';
import { getSubjectTitle, tr } from '../i18n/translations.ts';
import {
  ApiError,
  apiFetch,
  fileToBase64,
  getUiTabState,
  saveUiTabState,
} from '../lib/api.ts';
import type {
  HomeworkAssignment,
  HomeworkSubmission,
  Lang,
  NotificationItem,
  SchoolTest,
  SmsLogItem,
  SubjectInfo,
  TestAttemptResult,
  TestQuestion,
  ThemeMode,
  UserProfile,
} from '../types/lms.ts';
import { MiniColumnChart, SubjectProgressChart } from './Charts.tsx';
import { LanguageSwitcher } from './LanguageSwitcher.tsx';
import { ThemeToggleButton } from './ThemeToggleButton.tsx';

interface TeacherCabinetProps {
  user: UserProfile;
  lang: Lang;
  onLangChange: (lang: Lang) => void;
  theme: ThemeMode;
  onToggleTheme: () => void;
  onLogout: () => void;
}

type TeacherTab =
  | 'overview'
  | 'submissions'
  | 'create_hw'
  | 'create_test'
  | 'analytics'
  | 'sms'
  | 'notifications';

interface TeacherDashboardData {
  teacher: UserProfile;
  assignedGrades: number[];
  subjects: SubjectInfo[];
  allSubjects: SubjectInfo[];
  students: UserProfile[];
  homeworks: HomeworkAssignment[];
  submissions: HomeworkSubmission[];
  tests: SchoolTest[];
  testResults: TestAttemptResult[];
  notifications: NotificationItem[];
  smsLogs: SmsLogItem[];
}

function createEmpty20Questions(): TestQuestion[] {
  return Array.from({ length: 20 }, (_, i) => ({
    id: `draft-${i + 1}`,
    question: '',
    options: ['', '', '', ''],
    correctIndex: 0,
    explanation: '',
  }));
}

export function TeacherCabinet({
  user,
  lang,
  onLangChange,
  theme,
  onToggleTheme,
  onLogout,
}: TeacherCabinetProps) {
  const [tab, setTab] = useState<TeacherTab>(
    () => getUiTabState('teacher_tab', 'overview') as TeacherTab
  );
  const [data, setData] = useState<TeacherDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Submission review state
  const [subFilter, setSubFilter] = useState<'all' | 'pending' | 'approved' | 'revision'>('all');
  const [reviewMarks, setReviewMarks] = useState<Record<string, number>>({});
  const [reviewComments, setReviewComments] = useState<Record<string, string>>({});

  // Create Homework form state
  const [hwTitle, setHwTitle] = useState('');
  const [hwGrade, setHwGrade] = useState(5);
  const [hwSubject, setHwSubject] = useState('math');
  const [hwTopic, setHwTopic] = useState('');
  const [hwDeadline, setHwDeadline] = useState(() =>
    new Date(Date.now() + 3 * 24 * 3600 * 1000).toISOString().slice(0, 16)
  );
  const [hwDescription, setHwDescription] = useState('');
  const [hwVideoUrl, setHwVideoUrl] = useState('');
  const [hwExplanation, setHwExplanation] = useState('');
  const [hwPdf, setHwPdf] = useState<{ name: string; base64: string } | null>(null);
  const [hwImg, setHwImg] = useState<{ name: string; base64: string } | null>(null);

  // 20-question test builder
  const [testTitle, setTestTitle] = useState('');
  const [testGrade, setTestGrade] = useState(5);
  const [testSubject, setTestSubject] = useState('math');
  const [testDuration, setTestDuration] = useState(25);
  const [questions, setQuestions] = useState<TestQuestion[]>(createEmpty20Questions);
  const [activeQIdx, setActiveQIdx] = useState(0);

  // Student analytics selection
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');
  const [includeParentsSms, setIncludeParentsSms] = useState(true);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch<TeacherDashboardData>('/api/teacher/dashboard');
      setData(res);
      if (res.students.length > 0) {
        setSelectedStudentId((prev) => prev || res.students[0].id);
      }
      if (res.subjects.length > 0) {
        setHwSubject((prev) =>
          res.subjects.some((s) => s.id === prev) ? prev : res.subjects[0].id
        );
        setTestSubject((prev) =>
          res.subjects.some((s) => s.id === prev) ? prev : res.subjects[0].id
        );
      }
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        onLogout();
        return;
      }
      setError(err instanceof Error ? err.message : 'Yuklashda xatolik');
    } finally {
      setLoading(false);
    }
  }, [onLogout]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  function switchTab(next: TeacherTab) {
    setTab(next);
    saveUiTabState('teacher_tab', next);
    setNotice(null);
  }

  async function handleReviewSubmission(
    subId: string,
    status: 'approved' | 'revision'
  ) {
    setNotice(null);
    const mark5 = reviewMarks[subId] ?? (status === 'approved' ? 5 : 2);
    const score =
      mark5 === 5 ? 95 : mark5 === 4 ? 82 : mark5 === 3 ? 68 : 45;
    const teacherComment =
      reviewComments[subId] ||
      (status === 'approved'
        ? 'Vazifa to‘g‘ri bajarilgan ✓'
        : 'Xatolarni tuzatib qayta yuboring.');

    try {
      await apiFetch(`/api/teacher/submissions/${subId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status, mark5, score, teacherComment }),
      });
      setNotice('Baholash saqlandi va o‘quvchi kabinetida yangilandi ✓');
      await loadDashboard();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Saqlashda xatolik');
    }
  }

  async function handleCreateHomework(e: React.FormEvent) {
    e.preventDefault();
    setNotice(null);
    setError(null);
    try {
      await apiFetch('/api/teacher/homeworks', {
        method: 'POST',
        body: JSON.stringify({
          title: hwTitle,
          grade: hwGrade,
          subjectId: hwSubject,
          topic: hwTopic,
          deadline: hwDeadline,
          description: hwDescription,
          helpVideoUrl: hwVideoUrl,
          helpExplanation: hwExplanation,
          pdfFileName: hwPdf?.name,
          pdfBase64: hwPdf?.base64,
          imgFileName: hwImg?.name,
          imgBase64: hwImg?.base64,
        }),
      });
      setHwTitle('');
      setHwTopic('');
      setHwDescription('');
      setHwVideoUrl('');
      setHwExplanation('');
      setHwPdf(null);
      setHwImg(null);
      setNotice('Uy vazifasi yaratildi va o‘quvchilarga yuborildi ✓');
      await loadDashboard();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Vazifa yaratishda xatolik');
    }
  }

  async function handleCreateTest(e: React.FormEvent) {
    e.preventDefault();
    setNotice(null);
    setError(null);
    try {
      await apiFetch('/api/teacher/tests', {
        method: 'POST',
        body: JSON.stringify({
          title: testTitle,
          grade: testGrade,
          subjectId: testSubject,
          durationMinutes: testDuration,
          questions,
        }),
      });
      setTestTitle('');
      setQuestions(createEmpty20Questions());
      setActiveQIdx(0);
      setNotice('20 savollik test muvaffaqiyatli yaratildi ✓');
      await loadDashboard();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Test yaratishda xatolik');
    }
  }

  function autoFillEmptyQuestionsTemplate() {
    setQuestions((prev) =>
      prev.map((q, idx) =>
        q.question.trim()
          ? q
          : {
              ...q,
              question: `${idx + 1}. ${testTitle || 'Mavzu'} bo‘yicha ${idx + 1}-savol`,
              options: ['To‘g‘ri javob A', 'Variant B', 'Variant C', 'Variant D'],
              correctIndex: 0,
              explanation: `${idx + 1}-savol uchun to‘g‘ri javob izohi.`,
            }
      )
    );
  }

  async function handleSendOverdueSms() {
    setNotice(null);
    try {
      const res = await apiFetch<{ count: number }>(
        '/api/teacher/sms/send-overdue',
        {
          method: 'POST',
          body: JSON.stringify({ includeParents: includeParentsSms }),
        }
      );
      setNotice(`${res.count} ta SMS eslatma qayta ishlandi.`);
      await loadDashboard();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'SMS yuborishda xatolik');
    }
  }

  const navItems: { id: TeacherTab; label: string; icon: typeof Inbox }[] = [
    { id: 'overview', label: tr(lang, 'navOverview'), icon: Inbox },
    { id: 'submissions', label: tr(lang, 'navSubmissions'), icon: CheckCircle2 },
    { id: 'create_hw', label: tr(lang, 'navCreateHomework'), icon: FilePlus2 },
    { id: 'create_test', label: tr(lang, 'navCreateTest'), icon: PlusCircle },
    { id: 'analytics', label: tr(lang, 'navAnalytics'), icon: BarChart3 },
    { id: 'sms', label: tr(lang, 'navSms'), icon: MessageSquare },
    { id: 'notifications', label: tr(lang, 'navNotifications'), icon: Bell },
  ];

  function TeacherAvatar({ size = 'w-9 h-9' }: { size?: string }) {
    return user.avatarUrl ? (
      <img
        src={user.avatarUrl}
        alt={`${user.firstName} ${user.lastName}`}
        className={`${size} rounded-full object-cover border-2 border-emerald-500 shrink-0`}
      />
    ) : (
      <span
        className={`${size} rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 inline-flex items-center justify-center border border-emerald-300 dark:border-emerald-700 shrink-0`}
      >
        <UserIcon className="w-4 h-4" />
      </span>
    );
  }

  const filteredSubmissions = (data?.submissions || []).filter((s) =>
    subFilter === 'all' ? true : s.status === subFilter
  );

  const selectedStudent =
    data?.students.find((s) => s.id === selectedStudentId) || data?.students[0];

  const studentSubs = selectedStudent
    ? (data?.submissions || []).filter((s) => s.studentId === selectedStudent.id)
    : [];
  const studentHomeworksTotal = selectedStudent
    ? (data?.homeworks || []).filter((h) => h.grade === selectedStudent.grade).length
    : 0;
  const studentTests = selectedStudent
    ? (data?.testResults || []).filter((r) => r.studentId === selectedStudent.id)
    : [];
  const totalCorrect = studentTests.reduce((a, b) => a + b.correctCount, 0);
  const totalWrong = studentTests.reduce((a, b) => a + b.wrongCount, 0);
  const avgScore = studentTests.length
    ? Math.round(
        studentTests.reduce((a, b) => a + b.percentage, 0) / studentTests.length
      )
    : 0;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col pb-16 lg:pb-0">
      <header className="sticky top-0 z-30 border-b border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xs px-4 sm:px-6 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <span className="text-base sm:text-lg font-extrabold tracking-tight whitespace-nowrap shrink-0">
              {tr(lang, 'brand')}
            </span>
            {/* Teacher photo strictly BEFORE First & Last Name */}
            <div className="hidden sm:flex items-center gap-2 min-w-0">
              <TeacherAvatar size="w-8 h-8" />
              <span className="text-xs font-semibold truncate">
                {user.firstName} {user.lastName}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <LanguageSwitcher lang={lang} onChange={onLangChange} />
            <ThemeToggleButton theme={theme} onToggle={onToggleTheme} lang={lang} />
            <button
              type="button"
              onClick={onLogout}
              className="min-h-[38px] px-3 inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden md:inline">{tr(lang, 'logout')}</span>
            </button>
          </div>
        </div>
      </header>

      <div className="flex-1 max-w-7xl w-full mx-auto flex gap-6 px-3 sm:px-6 py-5">
        <aside className="hidden lg:flex flex-col w-64 shrink-0 space-y-1">
          {/* Teacher Portrait before Name */}
          <div className="p-3.5 mb-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center gap-3">
            <TeacherAvatar size="w-11 h-11" />
            <div className="min-w-0">
              <p className="text-sm font-bold text-slate-900 dark:text-white truncate">
                {user.firstName} {user.lastName}
              </p>
              <p className="text-xs text-emerald-600 dark:text-emerald-400">
                {tr(lang, 'teacherRole')} · Bepul
              </p>
            </div>
          </div>

          {navItems.map((item) => {
            const Icon = item.icon;
            const active = tab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => switchTab(item.id)}
                className={`w-full min-h-[42px] px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-2.5 cursor-pointer transition-colors ${
                  active
                    ? 'bg-emerald-600 text-white'
                    : 'text-slate-700 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-900'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </aside>

        <main className="flex-1 min-w-0 space-y-5">
          {notice && (
            <div className="rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 p-3.5 text-xs font-semibold text-emerald-800 dark:text-emerald-300">
              {notice}
            </div>
          )}
          {error && (
            <div className="rounded-xl border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/40 p-3.5 text-xs text-rose-700 dark:text-rose-300">
              {error}
            </div>
          )}

          {loading && !data ? (
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 text-center text-sm text-slate-500">
              O‘qituvchi kabineti yuklanmoqda...
            </div>
          ) : data ? (
            <>
              {/* OVERVIEW TAB */}
              {tab === 'overview' && (
                <div className="space-y-5">
                  <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <TeacherAvatar size="w-12 h-12" />
                      <div>
                        <h1 className="text-lg sm:text-xl font-bold">
                          {user.firstName} {user.lastName}
                        </h1>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          Sinflar: {data.assignedGrades.join(', ')} · Fanlar:{' '}
                          {data.subjects.map((s) => getSubjectTitle(s, lang)).join(', ')}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => switchTab('submissions')}
                      className="min-h-[40px] px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-semibold cursor-pointer"
                    >
                      {tr(lang, 'navSubmissions')} ({data.submissions.filter((s) => s.status === 'pending').length})
                    </button>
                  </div>

                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
                      <p className="text-xs text-slate-500">O‘quvchilar</p>
                      <p className="text-2xl font-bold font-mono-num mt-1">{data.students.length}</p>
                    </div>
                    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
                      <p className="text-xs text-slate-500">Kutilayotgan ishlar</p>
                      <p className="text-2xl font-bold font-mono-num text-amber-600 mt-1">
                        {data.submissions.filter((s) => s.status === 'pending').length}
                      </p>
                    </div>
                    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
                      <p className="text-xs text-slate-500">Uy vazifalari</p>
                      <p className="text-2xl font-bold font-mono-num mt-1">{data.homeworks.length}</p>
                    </div>
                    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
                      <p className="text-xs text-slate-500">20 savollik testlar</p>
                      <p className="text-2xl font-bold font-mono-num mt-1">{data.tests.length}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {/* Incoming Homeworks Quick Desk */}
                    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-3">
                      <div className="flex items-center justify-between">
                        <h2 className="text-sm sm:text-base font-bold">
                          {tr(lang, 'incomingHomeworks')} ({tr(lang, 'navSubmissions')})
                        </h2>
                        <button
                          type="button"
                          onClick={() => switchTab('submissions')}
                          className="text-xs font-semibold text-sky-600 dark:text-sky-400 cursor-pointer"
                        >
                          Barchasi →
                        </button>
                      </div>
                      {data.submissions.length === 0 ? (
                        <p className="text-xs text-slate-500">{tr(lang, 'noData')}</p>
                      ) : (
                        <div className="space-y-2">
                          {data.submissions.slice(0, 4).map((s) => (
                            <div
                              key={s.id}
                              className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex items-center justify-between gap-2 text-xs"
                            >
                              <div className="min-w-0">
                                <p className="font-semibold truncate">
                                  {s.studentName} ({s.grade}-sinf)
                                </p>
                                <p className="text-slate-500 truncate">{s.topic}</p>
                              </div>
                              <span
                                className={`font-semibold shrink-0 ${
                                  s.status === 'approved'
                                    ? 'text-emerald-600'
                                    : s.status === 'revision'
                                    ? 'text-rose-600'
                                    : 'text-amber-600'
                                }`}
                              >
                                {s.status === 'approved'
                                  ? 'Qabul qilindi ✓'
                                  : s.status === 'revision'
                                  ? 'Qayta ishlash'
                                  : 'Kutilmoqda'}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Grading Rubric */}
                    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-3">
                      <h2 className="text-sm sm:text-base font-bold flex items-center gap-2">
                        <ClipboardList className="w-4 h-4 text-emerald-600" />
                        {tr(lang, 'gradingRubric')}
                      </h2>
                      <div className="space-y-2 text-xs">
                        <div className="p-2.5 rounded-xl border border-emerald-200 dark:border-emerald-900 bg-emerald-50/60 dark:bg-emerald-950/30 flex justify-between">
                          <span className="font-bold text-emerald-700 dark:text-emerald-300">5 · A’lo</span>
                          <span className="font-mono-num">90–100% · To‘liq va bexato bajarilgan</span>
                        </div>
                        <div className="p-2.5 rounded-xl border border-sky-200 dark:border-sky-900 bg-sky-50/60 dark:bg-sky-950/30 flex justify-between">
                          <span className="font-bold text-sky-700 dark:text-sky-300">4 · Yaxshi</span>
                          <span className="font-mono-num">75–89% · Kichik izohlar bilan to‘g‘ri</span>
                        </div>
                        <div className="p-2.5 rounded-xl border border-amber-200 dark:border-amber-900 bg-amber-50/60 dark:bg-amber-950/30 flex justify-between">
                          <span className="font-bold text-amber-700 dark:text-amber-300">3 · Qoniqarli</span>
                          <span className="font-mono-num">60–74% · Asosiy qismi bajarilgan</span>
                        </div>
                        <div className="p-2.5 rounded-xl border border-rose-200 dark:border-rose-900 bg-rose-50/60 dark:bg-rose-950/30 flex justify-between">
                          <span className="font-bold text-rose-700 dark:text-rose-300">2 · Qayta ishlash</span>
                          <span className="font-mono-num">0–59% · Xatolar bor, qayta yuborish</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* SUBMISSIONS REVIEW DESK */}
              {tab === 'submissions' && (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h2 className="text-lg font-bold">{tr(lang, 'navSubmissions')}</h2>
                    <div className="flex flex-wrap gap-1.5">
                      {(
                        [
                          { id: 'all', label: tr(lang, 'allFilter') },
                          { id: 'pending', label: tr(lang, 'statusPending') },
                          { id: 'approved', label: tr(lang, 'statusApproved') },
                          { id: 'revision', label: 'Qayta ishlash' },
                        ] as const
                      ).map((f) => (
                        <button
                          key={f.id}
                          type="button"
                          onClick={() => setSubFilter(f.id)}
                          className={`min-h-[36px] px-3 rounded-lg text-xs font-semibold border cursor-pointer ${
                            subFilter === f.id
                              ? 'border-emerald-600 bg-emerald-600 text-white'
                              : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900'
                          }`}
                        >
                          {f.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {filteredSubmissions.length === 0 ? (
                    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 text-xs text-slate-500">
                      Tanlangan holatda topshirilgan ishlar topilmadi.
                    </div>
                  ) : (
                    filteredSubmissions.map((sub) => {
                      const subj = data.allSubjects.find((x) => x.id === sub.subjectId);
                      const selectedMark = reviewMarks[sub.id] ?? sub.mark5 ?? 5;
                      return (
                        <div
                          key={sub.id}
                          className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 space-y-3"
                        >
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div>
                              <h3 className="text-sm sm:text-base font-bold">
                                {sub.studentName} · {sub.grade}-{tr(lang, 'gradeLabel')}
                              </h3>
                              <p className="text-xs text-slate-500 dark:text-slate-400">
                                {subj ? getSubjectTitle(subj, lang) : sub.subjectId} ·{' '}
                                {sub.topic} ·{' '}
                                {new Date(sub.submittedAt).toLocaleString('uz-UZ')}
                              </p>
                            </div>
                            <span
                              className={`text-xs font-bold ${
                                sub.status === 'approved'
                                  ? 'text-emerald-600'
                                  : sub.status === 'revision'
                                  ? 'text-rose-600'
                                  : 'text-amber-600'
                              }`}
                            >
                              {sub.status === 'approved'
                                ? 'Qabul qilindi ✓'
                                : sub.status === 'revision'
                                ? 'Xatolar bor, qayta ishlash'
                                : 'Kutilmoqda'}
                            </span>
                          </div>

                          <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs sm:text-sm space-y-1.5">
                            <p>{sub.answerText || 'Matn kiritilmagan.'}</p>
                            {sub.attachmentUrl && (
                              <a
                                href={sub.attachmentUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-block text-sky-600 dark:text-sky-400 font-semibold underline"
                              >
                                Biriktirilgan fayl: {sub.attachmentName || 'Ochish'}
                              </a>
                            )}
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 pt-1 items-center">
                            <div className="md:col-span-3 flex items-center gap-1.5">
                              <span className="text-xs text-slate-500 mr-1">Baho:</span>
                              {[5, 4, 3, 2].map((m) => (
                                <button
                                  key={m}
                                  type="button"
                                  onClick={() =>
                                    setReviewMarks((prev) => ({ ...prev, [sub.id]: m }))
                                  }
                                  className={`w-8 h-8 rounded-lg text-xs font-mono-num font-bold border cursor-pointer ${
                                    selectedMark === m
                                      ? 'border-emerald-600 bg-emerald-600 text-white'
                                      : 'border-slate-200 dark:border-slate-700'
                                  }`}
                                >
                                  {m}
                                </button>
                              ))}
                            </div>
                            <div className="md:col-span-5">
                              <input
                                type="text"
                                value={reviewComments[sub.id] ?? sub.teacherComment ?? ''}
                                onChange={(e) =>
                                  setReviewComments((prev) => ({
                                    ...prev,
                                    [sub.id]: e.target.value,
                                  }))
                                }
                                placeholder="O‘qituvchi izohini yozing..."
                                className="w-full min-h-[38px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs"
                              />
                            </div>
                            <div className="md:col-span-4 flex flex-wrap gap-2 justify-end">
                              <button
                                type="button"
                                onClick={() => handleReviewSubmission(sub.id, 'revision')}
                                className="min-h-[38px] px-3 rounded-xl border border-rose-300 dark:border-rose-800 text-rose-600 dark:text-rose-400 text-xs font-semibold cursor-pointer"
                              >
                                {tr(lang, 'revisionBtn')}
                              </button>
                              <button
                                type="button"
                                onClick={() => handleReviewSubmission(sub.id, 'approved')}
                                className="min-h-[38px] px-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold cursor-pointer"
                              >
                                {tr(lang, 'approveBtn')}
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              )}

              {/* CREATE HOMEWORK TAB */}
              {tab === 'create_hw' && (
                <form
                  onSubmit={handleCreateHomework}
                  className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4 max-w-3xl"
                >
                  <h2 className="text-lg font-bold">{tr(lang, 'navCreateHomework')}</h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium mb-1">Vazifa nomi</label>
                      <input
                        type="text"
                        required
                        value={hwTitle}
                        onChange={(e) => setHwTitle(e.target.value)}
                        placeholder="Masalan: Kvadrat tenglamalar"
                        className="w-full min-h-[42px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1">Mavzu</label>
                      <input
                        type="text"
                        required
                        value={hwTopic}
                        onChange={(e) => setHwTopic(e.target.value)}
                        placeholder="Mavzu nomi"
                        className="w-full min-h-[42px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-sm"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-medium mb-1">Sinf</label>
                      <select
                        value={hwGrade}
                        onChange={(e) => setHwGrade(Number(e.target.value))}
                        className="w-full min-h-[42px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-sm"
                      >
                        {data.assignedGrades.map((g) => (
                          <option key={g} value={g}>
                            {g}-sinf
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1">Fan</label>
                      <select
                        value={hwSubject}
                        onChange={(e) => setHwSubject(e.target.value)}
                        className="w-full min-h-[42px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-sm"
                      >
                        {data.subjects.map((s) => (
                          <option key={s.id} value={s.id}>
                            {getSubjectTitle(s, lang)}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1">Topshirish muddati</label>
                      <input
                        type="datetime-local"
                        required
                        value={hwDeadline}
                        onChange={(e) => setHwDeadline(e.target.value)}
                        className="w-full min-h-[42px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-sm"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium mb-1">Topshiriq sharti</label>
                    <textarea
                      rows={3}
                      value={hwDescription}
                      onChange={(e) => setHwDescription(e.target.value)}
                      placeholder="O‘quvchilar nima bajarishi kerak?"
                      className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-sm"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium mb-1">
                        Yordamchi YouTube video havola
                      </label>
                      <input
                        type="url"
                        value={hwVideoUrl}
                        onChange={(e) => setHwVideoUrl(e.target.value)}
                        placeholder="https://www.youtube.com/watch?v=..."
                        className="w-full min-h-[42px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1">Qo‘shimcha tushuntirish</label>
                      <input
                        type="text"
                        value={hwExplanation}
                        onChange={(e) => setHwExplanation(e.target.value)}
                        placeholder="Masalani yechish bo‘yicha maslahat"
                        className="w-full min-h-[42px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-sm"
                      />
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <label className="min-h-[40px] px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-medium inline-flex items-center gap-2 cursor-pointer">
                      <Upload className="w-4 h-4" />
                      <span>{hwPdf?.name || 'PDF / fayl yuklash'}</span>
                      <input
                        type="file"
                        accept=".pdf,.doc,.docx,.txt"
                        className="hidden"
                        onChange={async (e) => {
                          const f = e.target.files?.[0];
                          if (!f) return;
                          setHwPdf({ name: f.name, base64: await fileToBase64(f) });
                        }}
                      />
                    </label>
                    <label className="min-h-[40px] px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-medium inline-flex items-center gap-2 cursor-pointer">
                      <Upload className="w-4 h-4" />
                      <span>{hwImg?.name || 'Rasm yuklash'}</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={async (e) => {
                          const f = e.target.files?.[0];
                          if (!f) return;
                          setHwImg({ name: f.name, base64: await fileToBase64(f) });
                        }}
                      />
                    </label>
                  </div>

                  <button
                    type="submit"
                    className="min-h-[44px] px-6 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold cursor-pointer"
                  >
                    Uy vazifasini e’lon qilish
                  </button>
                </form>
              )}

              {/* 20-QUESTION TEST BUILDER */}
              {tab === 'create_test' && (
                <form
                  onSubmit={handleCreateTest}
                  className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h2 className="text-lg font-bold">20 savollik test yaratish</h2>
                    <button
                      type="button"
                      onClick={autoFillEmptyQuestionsTemplate}
                      className="min-h-[36px] px-3 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold cursor-pointer"
                    >
                      Bo‘sh savollarni namuna bilan to‘ldirish
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                    <input
                      type="text"
                      required
                      value={testTitle}
                      onChange={(e) => setTestTitle(e.target.value)}
                      placeholder="Test nomi"
                      className="sm:col-span-2 min-h-[42px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-sm"
                    />
                    <select
                      value={testGrade}
                      onChange={(e) => setTestGrade(Number(e.target.value))}
                      className="min-h-[42px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-sm"
                    >
                      {data.assignedGrades.map((g) => (
                        <option key={g} value={g}>
                          {g}-sinf
                        </option>
                      ))}
                    </select>
                    <select
                      value={testSubject}
                      onChange={(e) => setTestSubject(e.target.value)}
                      className="min-h-[42px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-sm"
                    >
                      {data.subjects.map((s) => (
                        <option key={s.id} value={s.id}>
                          {getSubjectTitle(s, lang)}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* 5x4 on mobile, 10x2 on desktop */}
                  <div className="grid grid-cols-5 sm:grid-cols-10 gap-1.5">
                    {questions.map((q, i) => {
                      const filled = Boolean(q.question.trim() && q.options.every((o) => o.trim()));
                      return (
                        <button
                          key={q.id}
                          type="button"
                          onClick={() => setActiveQIdx(i)}
                          className={`min-h-[38px] rounded-lg text-xs font-mono-num font-bold border cursor-pointer ${
                            activeQIdx === i
                              ? 'border-sky-600 bg-sky-600 text-white'
                              : filled
                              ? 'border-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                              : 'border-slate-200 dark:border-slate-700'
                          }`}
                        >
                          {i + 1}
                        </button>
                      );
                    })}
                  </div>

                  {questions[activeQIdx] && (
                    <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-sky-600">
                          {activeQIdx + 1}-savol (20 tadan)
                        </span>
                        <label className="text-xs flex items-center gap-2">
                          Davomiylik (daq):
                          <input
                            type="number"
                            min={5}
                            max={120}
                            value={testDuration}
                            onChange={(e) => setTestDuration(Number(e.target.value))}
                            className="w-16 px-2 py-1 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-mono-num"
                          />
                        </label>
                      </div>
                      <input
                        type="text"
                        value={questions[activeQIdx].question}
                        onChange={(e) => {
                          const val = e.target.value;
                          setQuestions((prev) => {
                            const copy = [...prev];
                            copy[activeQIdx] = { ...copy[activeQIdx], question: val };
                            return copy;
                          });
                        }}
                        placeholder={`${activeQIdx + 1}-savol matnini kiriting`}
                        className="w-full min-h-[42px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm"
                      />
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        {(['A', 'B', 'C', 'D'] as const).map((letter, optIdx) => (
                          <div key={letter} className="flex items-center gap-2">
                            <input
                              type="radio"
                              name={`correct-${activeQIdx}`}
                              checked={questions[activeQIdx].correctIndex === optIdx}
                              onChange={() =>
                                setQuestions((prev) => {
                                  const copy = [...prev];
                                  copy[activeQIdx] = {
                                    ...copy[activeQIdx],
                                    correctIndex: optIdx as 0 | 1 | 2 | 3,
                                  };
                                  return copy;
                                })
                              }
                            />
                            <input
                              type="text"
                              value={questions[activeQIdx].options[optIdx]}
                              onChange={(e) => {
                                const val = e.target.value;
                                setQuestions((prev) => {
                                  const copy = [...prev];
                                  const opts = [...copy[activeQIdx].options] as [
                                    string,
                                    string,
                                    string,
                                    string
                                  ];
                                  opts[optIdx] = val;
                                  copy[activeQIdx] = { ...copy[activeQIdx], options: opts };
                                  return copy;
                                });
                              }}
                              placeholder={`${letter} varianti`}
                              className="flex-1 min-h-[38px] px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
                            />
                          </div>
                        ))}
                      </div>
                      <input
                        type="text"
                        value={questions[activeQIdx].explanation}
                        onChange={(e) => {
                          const val = e.target.value;
                          setQuestions((prev) => {
                            const copy = [...prev];
                            copy[activeQIdx] = { ...copy[activeQIdx], explanation: val };
                            return copy;
                          });
                        }}
                        placeholder="To‘g‘ri javob izohi"
                        className="w-full min-h-[38px] px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
                      />
                    </div>
                  )}

                  <button
                    type="submit"
                    className="min-h-[44px] px-6 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold cursor-pointer"
                  >
                    20 savollik testni saqlash
                  </button>
                </form>
              )}

              {/* STUDENT ANALYTICS */}
              {tab === 'analytics' && (
                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <h2 className="text-lg font-bold">{tr(lang, 'navAnalytics')}</h2>
                    <select
                      value={selectedStudent?.id || ''}
                      onChange={(e) => setSelectedStudentId(e.target.value)}
                      className="min-h-[42px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm"
                    >
                      {data.students.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.firstName} {s.lastName} ({s.grade}-sinf)
                        </option>
                      ))}
                    </select>
                  </div>

                  {selectedStudent && (
                    <>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
                          <p className="text-xs text-slate-500">Jami / Bajarilgan vazifa</p>
                          <p className="text-xl font-bold font-mono-num mt-1">
                            {studentSubs.length} / {studentHomeworksTotal}
                          </p>
                        </div>
                        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
                          <p className="text-xs text-slate-500">Qabul / Kutilmoqda / Xato</p>
                          <p className="text-xl font-bold font-mono-num mt-1">
                            {studentSubs.filter((s) => s.status === 'approved').length} /{' '}
                            {studentSubs.filter((s) => s.status === 'pending').length} /{' '}
                            {studentSubs.filter((s) => s.status === 'revision').length}
                          </p>
                        </div>
                        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
                          <p className="text-xs text-slate-500">Testlar (To‘g‘ri / Xato)</p>
                          <p className="text-xl font-bold font-mono-num mt-1">
                            {studentTests.length} ({totalCorrect}/{totalWrong})
                          </p>
                        </div>
                        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
                          <p className="text-xs text-slate-500">O‘rtacha ball</p>
                          <p className="text-xl font-bold font-mono-num text-emerald-600 mt-1">
                            {avgScore}%
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        <SubjectProgressChart
                          title="Fanlar bo‘yicha rivojlanish"
                          accentClass="bg-emerald-600"
                          data={data.subjects.map((subj) => {
                            const resList = studentTests.filter(
                              (r) => r.subjectId === subj.id
                            );
                            const avg = resList.length
                              ? Math.round(
                                  resList.reduce((a, b) => a + b.percentage, 0) /
                                    resList.length
                                )
                              : 0;
                            return {
                              label: getSubjectTitle(subj, lang),
                              value: avg,
                              sublabel: `${resList.length} test`,
                            };
                          })}
                        />
                        <MiniColumnChart
                          title="Test natijalari dinamikasi (%)"
                          bars={studentTests.slice(0, 6).map((r, i) => ({
                            label: `T${i + 1}`,
                            value: r.percentage,
                            color: 'bg-emerald-600',
                          }))}
                        />
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* SMS LOGS TAB */}
              {tab === 'sms' && (
                <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h2 className="text-base font-bold">Muddati o‘tgan vazifalar SMS nazorati</h2>
                      <p className="text-xs text-slate-500">
                        Topshirilgan va bekor qilingan vazifalarga takroriy SMS yuborilmaydi.
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <label className="text-xs inline-flex items-center gap-1.5">
                        <input
                          type="checkbox"
                          checked={includeParentsSms}
                          onChange={(e) => setIncludeParentsSms(e.target.checked)}
                        />
                        Ota-onalarga ham yuborish
                      </label>
                      <button
                        type="button"
                        onClick={handleSendOverdueSms}
                        className="min-h-[38px] px-3.5 rounded-xl bg-sky-600 text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                      >
                        <Send className="w-3.5 h-3.5" />
                        Tekshirish va yuborish
                      </button>
                    </div>
                  </div>
                  {data.smsLogs.length === 0 ? (
                    <p className="text-xs text-slate-500">{tr(lang, 'noData')}</p>
                  ) : (
                    <div className="space-y-2">
                      {data.smsLogs.map((log) => (
                        <div
                          key={log.id}
                          className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs space-y-1"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-bold">
                              {log.studentName} ({log.grade}-sinf · {log.target === 'parent' ? 'Ota-ona' : 'O‘quvchi'})
                            </span>
                            <span className="font-mono-num text-slate-500">
                              {log.status === 'sent' ? 'Yuborildi ✓' : 'DEMO log'} ·{' '}
                              {new Date(log.sentAt).toLocaleString('uz-UZ')}
                            </span>
                          </div>
                          <p className="text-slate-600 dark:text-slate-300">{log.message}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* NOTIFICATIONS */}
              {tab === 'notifications' && (
                <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-3">
                  <h2 className="text-base font-bold">{tr(lang, 'navNotifications')}</h2>
                  {data.notifications.length === 0 ? (
                    <p className="text-xs text-slate-500">{tr(lang, 'noData')}</p>
                  ) : (
                    data.notifications.map((n) => (
                      <div
                        key={n.id}
                        className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs"
                      >
                        <p className="font-bold">{n.title}</p>
                        <p className="text-slate-600 dark:text-slate-300 mt-0.5">{n.message}</p>
                      </div>
                    ))
                  )}
                </div>
              )}
            </>
          ) : null}
        </main>
      </div>

      {/* Mobile Bottom Nav */}
      <nav className="lg:hidden fixed bottom-0 inset-x-0 z-30 border-t border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xs px-1 py-1 flex items-center justify-around">
        {navItems.slice(0, 5).map((item) => {
          const Icon = item.icon;
          const active = tab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => switchTab(item.id)}
              className={`min-h-[44px] px-2 py-1 flex flex-col items-center justify-center gap-0.5 text-[10px] font-semibold cursor-pointer ${
                active
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span className="truncate max-w-[60px]">{item.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
