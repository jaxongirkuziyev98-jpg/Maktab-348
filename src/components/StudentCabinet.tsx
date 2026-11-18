import { useCallback, useEffect, useState } from 'react';
import { motion } from 'motion/react';
import {
  Award,
  Bell,
  BookOpen,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  CreditCard,
  FileText,
  Globe,
  HelpCircle,
  Home,
  LogOut,
  Play,
  Star,
  Upload,
  Video,
  X,
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
  Ebook,
  HomeworkAssignment,
  HomeworkSubmission,
  Lang,
  NotificationItem,
  SchoolTest,
  SubjectInfo,
  TestAttemptResult,
  ThemeMode,
  UserProfile,
  VideoLesson,
} from '../types/lms.ts';
import { MiniColumnChart, SubjectProgressChart } from './Charts.tsx';
import { LanguageCenter } from './LanguageCenter.tsx';
import { LanguageSwitcher } from './LanguageSwitcher.tsx';
import { PdfBookReader } from './PdfBookReader.tsx';
import { SubscriptionModal } from './SubscriptionModal.tsx';
import { TestRunnerModal } from './TestRunnerModal.tsx';
import { ThemeToggleButton } from './ThemeToggleButton.tsx';
import { VideoLessonViewer, getYoutubeThumbnailUrl } from './VideoLessonViewer.tsx';

interface StudentCabinetProps {
  user: UserProfile;
  lang: Lang;
  onLangChange: (lang: Lang) => void;
  theme: ThemeMode;
  onToggleTheme: () => void;
  onUserUpdated: (user: UserProfile) => void;
  onPaymentRequired: () => void;
  onLogout: () => void;
}

type StudentTab =
  | 'home'
  | 'subjects'
  | 'videos'
  | 'ebooks'
  | 'homework'
  | 'tests'
  | 'grades'
  | 'languages'
  | 'notifications';

interface StudentDashboardData {
  student: UserProfile;
  subjects: SubjectInfo[];
  videos: VideoLesson[];
  ebooks: Ebook[];
  homeworks: HomeworkAssignment[];
  submissions: HomeworkSubmission[];
  tests: SchoolTest[];
  testResults: TestAttemptResult[];
  notifications: NotificationItem[];
}

export function StudentCabinet({
  user,
  lang,
  onLangChange,
  theme,
  onToggleTheme,
  onUserUpdated,
  onPaymentRequired,
  onLogout,
}: StudentCabinetProps) {
  const [tab, setTab] = useState<StudentTab>(
    () => getUiTabState('student_tab', 'home') as StudentTab
  );
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>(() =>
    getUiTabState('student_subject', 'math')
  );
  const [data, setData] = useState<StudentDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [activeVideo, setActiveVideo] = useState<VideoLesson | null>(null);
  const [activeBook, setActiveBook] = useState<Ebook | null>(null);
  const [activeTest, setActiveTest] = useState<SchoolTest | null>(null);
  const [helpHw, setHelpHw] = useState<HomeworkAssignment | null>(null);
  const [showSubModal, setShowSubModal] = useState(false);

  // Homework submission state
  const [answerMap, setAnswerMap] = useState<Record<string, string>>({});
  const [fileMap, setFileMap] = useState<
    Record<string, { name: string; base64: string }>
  >({});
  const [submittingHwId, setSubmittingHwId] = useState<string | null>(null);
  const [hwNotice, setHwNotice] = useState<string | null>(null);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch<StudentDashboardData>('/api/student/dashboard');
      setData(res);
      onUserUpdated(res.student);
      if (
        res.subjects.length > 0 &&
        !res.subjects.some((s) => s.id === selectedSubjectId)
      ) {
        setSelectedSubjectId(res.subjects[0].id);
      }
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 401) {
          onLogout();
          return;
        }
        if (err.status === 402) {
          onPaymentRequired();
          return;
        }
      }
      setError(err instanceof Error ? err.message : 'Ma’lumot yuklashda xatolik');
    } finally {
      setLoading(false);
    }
  }, [onLogout, onPaymentRequired, onUserUpdated, selectedSubjectId]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  function switchTab(next: StudentTab) {
    setTab(next);
    saveUiTabState('student_tab', next);
  }

  function switchSubject(id: string) {
    setSelectedSubjectId(id);
    saveUiTabState('student_subject', id);
  }

  async function handleSubmitHomework(hwId: string) {
    setSubmittingHwId(hwId);
    setHwNotice(null);
    try {
      const file = fileMap[hwId];
      await apiFetch('/api/student/homework/submit', {
        method: 'POST',
        body: JSON.stringify({
          homeworkId: hwId,
          answerText: answerMap[hwId] || '',
          fileName: file?.name,
          fileBase64: file?.base64,
        }),
      });
      setHwNotice('Vazifa yuborildi! O‘qituvchi tekshirguniga qadar "Kutilmoqda" holatida turadi.');
      await loadDashboard();
    } catch (err) {
      setHwNotice(err instanceof Error ? err.message : 'Yuborishda xatolik');
    } finally {
      setSubmittingHwId(null);
    }
  }

  async function handleMarkNotificationsRead() {
    await apiFetch('/api/notifications/read-all', { method: 'POST' }).catch(() => {});
    loadDashboard();
  }

  const isJunior = (user.grade || 5) <= 4;
  const subExpires = user.subscriptionExpiresAt
    ? new Date(user.subscriptionExpiresAt).getTime()
    : 0;
  const daysLeft = Math.max(0, Math.ceil((subExpires - Date.now()) / (24 * 3600 * 1000)));
  const unreadCount =
    data?.notifications.filter((n) => !n.read).length || 0;

  const navItems: { id: StudentTab; label: string; icon: typeof Home }[] = [
    { id: 'home', label: tr(lang, 'navHome'), icon: Home },
    { id: 'subjects', label: tr(lang, 'navSubjects'), icon: BookOpen },
    { id: 'videos', label: tr(lang, 'navVideos'), icon: Video },
    { id: 'ebooks', label: tr(lang, 'navEbooks'), icon: FileText },
    { id: 'homework', label: tr(lang, 'navHomework'), icon: Upload },
    { id: 'tests', label: tr(lang, 'navTests'), icon: ClipboardCheck },
    { id: 'grades', label: tr(lang, 'navGrades'), icon: Award },
    { id: 'languages', label: tr(lang, 'navLanguages'), icon: Globe },
    { id: 'notifications', label: tr(lang, 'navNotifications'), icon: Bell },
  ];

  const subjects = data?.subjects || [];
  const activeSubject =
    subjects.find((s) => s.id === selectedSubjectId) || subjects[0];
  const filteredVideos = (data?.videos || []).filter(
    (v) => tab !== 'subjects' || !activeSubject || v.subjectId === activeSubject.id
  );

  // Compute subject mastery chart data
  const masteryData = subjects.slice(0, 6).map((s) => {
    const subResults = (data?.testResults || []).filter((r) => r.subjectId === s.id);
    const avg = subResults.length
      ? Math.round(
          subResults.reduce((acc, r) => acc + r.percentage, 0) / subResults.length
        )
      : 0;
    return {
      label: getSubjectTitle(s, lang),
      value: avg,
      sublabel: subResults.length ? `${subResults.length} test` : 'Boshlanmagan',
    };
  });

  function renderHomeworkStatusBadge(sub?: HomeworkSubmission) {
    if (!sub) {
      return (
        <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
          Topshirilmagan
        </span>
      );
    }
    if (sub.status === 'approved') {
      return (
        <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
          <CheckCircle2 className="w-4 h-4" />
          {tr(lang, 'statusApproved')}
        </span>
      );
    }
    if (sub.status === 'revision') {
      return (
        <span className="text-xs font-semibold text-rose-600 dark:text-rose-400">
          {tr(lang, 'statusRevision')}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-600 dark:text-amber-400">
        <Clock className="w-3.5 h-3.5" />
        {tr(lang, 'statusPending')}
      </span>
    );
  }

  return (
    <div
      className={`min-h-screen flex flex-col pb-16 lg:pb-0 ${
        isJunior
          ? 'bg-sky-50/70 dark:bg-slate-950 text-slate-900 dark:text-slate-100'
          : 'bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100'
      }`}
    >
      {/* Top Bar */}
      <header className="sticky top-0 z-30 border-b border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xs px-4 sm:px-6 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <span className="text-base sm:text-lg font-extrabold tracking-tight text-slate-900 dark:text-white whitespace-nowrap shrink-0">
              {tr(lang, 'brand')}
            </span>
            <span className="hidden sm:inline text-xs text-slate-500 dark:text-slate-400 truncate">
              {user.firstName} {user.lastName} · {user.grade}-{tr(lang, 'gradeLabel')}
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setShowSubModal(true)}
              className="hidden sm:inline-flex items-center gap-1.5 min-h-[38px] px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-medium cursor-pointer whitespace-nowrap"
            >
              <CreditCard className="w-3.5 h-3.5 text-emerald-600" />
              <span className="font-mono-num">
                {daysLeft} {tr(lang, 'daysLeft')}
              </span>
            </button>
            <LanguageSwitcher lang={lang} onChange={onLangChange} />
            <ThemeToggleButton theme={theme} onToggle={onToggleTheme} lang={lang} />
            <button
              type="button"
              onClick={onLogout}
              className="min-h-[38px] px-2.5 sm:px-3 inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              title={tr(lang, 'logout')}
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden md:inline">{tr(lang, 'logout')}</span>
            </button>
          </div>
        </div>
      </header>

      <div className="flex-1 max-w-7xl w-full mx-auto flex gap-6 px-3 sm:px-6 py-5">
        {/* Desktop Sidebar */}
        <aside className="hidden lg:flex flex-col w-60 shrink-0 space-y-1">
          <div className="p-3.5 mb-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
            <p className="text-sm font-bold text-slate-900 dark:text-white truncate">
              {user.firstName} {user.lastName}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {user.grade}-{tr(lang, 'gradeLabel')} · {isJunior ? 'Yulduzli rejim' : 'Akademik panel'}
            </p>
          </div>
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = tab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => switchTab(item.id)}
                className={`w-full min-h-[42px] px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center justify-between gap-2 transition-colors cursor-pointer ${
                  active
                    ? isJunior
                      ? 'bg-amber-500 text-white shadow-xs'
                      : 'bg-sky-600 text-white shadow-xs'
                    : 'text-slate-700 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-900'
                }`}
              >
                <span className="inline-flex items-center gap-2.5 truncate">
                  <Icon className="w-4 h-4 shrink-0" />
                  <span className="truncate">{item.label}</span>
                </span>
                {item.id === 'notifications' && unreadCount > 0 && (
                  <span className="font-mono-num text-[11px] font-bold">
                    {unreadCount}
                  </span>
                )}
              </button>
            );
          })}
        </aside>

        {/* Main Viewport */}
        <main className="flex-1 min-w-0 space-y-5">
          {loading && !data ? (
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 text-center text-sm text-slate-500">
              O‘quvchi kabineti yuklanmoqda...
            </div>
          ) : error ? (
            <div className="rounded-2xl border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/40 p-5 text-sm text-rose-700 dark:text-rose-300">
              {error}
            </div>
          ) : data ? (
            <>
              {/* HOME TAB */}
              {tab === 'home' && (
                <div className="space-y-5">
                  {isJunior ? (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="rounded-2xl border border-amber-200 dark:border-amber-800 bg-gradient-to-r from-amber-50 via-white to-sky-50 dark:from-slate-900 dark:to-slate-900 p-5 flex flex-col sm:flex-row items-center gap-5"
                    >
                      <img
                        src="/src/assets/images/primary_badge_emblem_1795000758466.jpg"
                        alt="Boshlang‘ich sinf medali"
                        referrerPolicy="no-referrer"
                        className="w-24 h-24 rounded-full object-cover border-4 border-amber-300 dark:border-amber-600 shrink-0"
                      />
                      <div className="flex-1 text-center sm:text-left space-y-1.5">
                        <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white">
                          Salom, {user.firstName}! Bugun yangi yulduzchalar yig‘amiz
                        </h1>
                        <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300">
                          Har bir bajarilgan vazifa (+15 yulduz) va 20 savollik test senga yangi medallar olib keladi!
                        </p>
                        <div className="flex flex-wrap justify-center sm:justify-start gap-2 pt-1 text-xs font-semibold text-amber-700 dark:text-amber-300">
                          {(user.medals || ['Yangi bilimdon']).map((m) => (
                            <span key={m} className="inline-flex items-center gap-1">
                              <Award className="w-3.5 h-3.5" />
                              {m}
                            </span>
                          ))}
                        </div>
                      </div>
                    </motion.div>
                  ) : (
                    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <h1 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white">
                          {user.firstName} {user.lastName} — {user.grade}-{tr(lang, 'gradeLabel')}
                        </h1>
                        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                          {tr(lang, 'activeSub')} · {daysLeft} {tr(lang, 'daysLeft')}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowSubModal(true)}
                        className="min-h-[40px] px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer self-start sm:self-auto"
                      >
                        {tr(lang, 'renewSub')}
                      </button>
                    </div>
                  )}

                  {/* Stats Row (2+1 responsive on phones for junior, 4 cols for senior) */}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    {isJunior ? (
                      <div className="col-span-2 sm:col-span-1 rounded-xl border border-amber-200 dark:border-amber-800 bg-white dark:bg-slate-900 p-4">
                        <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
                          <Star className="w-3.5 h-3.5 text-amber-500" />
                          Yulduzchalar
                        </p>
                        <p className="text-2xl font-extrabold font-mono-num text-amber-600 dark:text-amber-400 mt-1">
                          {user.stars || 0}
                        </p>
                      </div>
                    ) : (
                      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
                        <p className="text-xs text-slate-500 dark:text-slate-400">Fanlar</p>
                        <p className="text-2xl font-bold font-mono-num mt-1">{subjects.length}</p>
                      </div>
                    )}
                    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
                      <p className="text-xs text-slate-500 dark:text-slate-400">Video darslar</p>
                      <p className="text-2xl font-bold font-mono-num mt-1">{data.videos.length}</p>
                    </div>
                    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
                      <p className="text-xs text-slate-500 dark:text-slate-400">Uy vazifalari</p>
                      <p className="text-2xl font-bold font-mono-num mt-1">
                        {data.submissions.filter((s) => s.status === 'approved').length} /{' '}
                        {data.homeworks.length}
                      </p>
                    </div>
                    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
                      <p className="text-xs text-slate-500 dark:text-slate-400">Test o‘rtacha</p>
                      <p className="text-2xl font-bold font-mono-num text-sky-600 dark:text-sky-400 mt-1">
                        {data.testResults.length
                          ? Math.round(
                              data.testResults.reduce((a, b) => a + b.percentage, 0) /
                                data.testResults.length
                            )
                          : 0}
                        %
                      </p>
                    </div>
                  </div>

                  {/* Charts for Grades 5-11 */}
                  {!isJunior && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      <SubjectProgressChart
                        title="Fanlar bo‘yicha o‘zlashtirish"
                        data={masteryData}
                      />
                      <MiniColumnChart
                        title="Oxirgi test natijalari (%)"
                        bars={data.testResults.slice(0, 6).map((r, i) => ({
                          label: `T${i + 1}`,
                          value: r.percentage,
                        }))}
                      />
                    </div>
                  )}

                  {/* Quick Grade-Matched YouTube Videos */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h2 className="text-base font-bold text-slate-900 dark:text-white">
                        {user.grade}-{tr(lang, 'gradeLabel')} uchun tavsiya etilgan video darslar
                      </h2>
                      <button
                        type="button"
                        onClick={() => switchTab('videos')}
                        className="text-xs font-semibold text-sky-600 dark:text-sky-400 cursor-pointer"
                      >
                        Barchasi →
                      </button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {data.videos.slice(0, 3).map((v) => {
                        const thumb = getYoutubeThumbnailUrl(v.videoUrl);
                        return (
                          <button
                            key={v.id}
                            type="button"
                            onClick={() => setActiveVideo(v)}
                            className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden text-left hover:border-sky-500 transition-colors cursor-pointer"
                          >
                            <div className="relative aspect-video bg-slate-900">
                              {thumb && (
                                <img
                                  src={thumb}
                                  alt={v.title}
                                  referrerPolicy="no-referrer"
                                  className="w-full h-full object-cover"
                                />
                              )}
                              <div className="absolute inset-0 bg-slate-950/35 flex items-center justify-center">
                                <span className="w-11 h-11 rounded-full bg-white/90 text-slate-900 flex items-center justify-center">
                                  <Play className="w-5 h-5 ml-0.5" />
                                </span>
                              </div>
                            </div>
                            <div className="p-3">
                              <p className="text-xs font-bold text-slate-900 dark:text-white line-clamp-2">
                                {v.title}
                              </p>
                              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                                {v.topic} · {v.durationMinutes} daq
                              </p>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* SUBJECTS TAB */}
              {tab === 'subjects' && activeSubject && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
                    {subjects.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => switchSubject(s.id)}
                        className={`min-h-[40px] px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap shrink-0 border cursor-pointer ${
                          s.id === activeSubject.id
                            ? 'border-sky-600 bg-sky-600 text-white'
                            : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        {getSubjectTitle(s, lang)}
                      </button>
                    ))}
                  </div>

                  <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 space-y-5">
                    <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                      {getSubjectTitle(activeSubject, lang)} — {user.grade}-{tr(lang, 'gradeLabel')}
                    </h2>

                    {/* Subject Video Lessons */}
                    <div className="space-y-2.5">
                      <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                        Video darslar
                      </h3>
                      {filteredVideos.map((v) => (
                        <div
                          key={v.id}
                          className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex flex-wrap items-center justify-between gap-2"
                        >
                          <div>
                            <p className="text-sm font-semibold">{v.title}</p>
                            <p className="text-xs text-slate-500">{v.topic} · {v.durationMinutes} daq</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => setActiveVideo(v)}
                            className="min-h-[38px] px-3.5 py-1.5 rounded-lg bg-sky-600 text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                          >
                            <Play className="w-3.5 h-3.5" />
                            {tr(lang, 'watchInside')}
                          </button>
                        </div>
                      ))}
                    </div>

                    {/* Subject Ebooks */}
                    <div className="space-y-2.5">
                      <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                        Elektron kitoblar (PDF)
                      </h3>
                      {data.ebooks
                        .filter((b) => b.subjectId === activeSubject.id)
                        .map((b) => (
                          <div
                            key={b.id}
                            className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex flex-wrap items-center justify-between gap-2"
                          >
                            <div>
                              <p className="text-sm font-semibold">{b.title}</p>
                              <p className="text-xs text-slate-500">{b.pagesCount} sahifa</p>
                            </div>
                            <button
                              type="button"
                              onClick={() => setActiveBook(b)}
                              className="min-h-[38px] px-3.5 py-1.5 rounded-lg bg-slate-900 dark:bg-slate-700 text-white text-xs font-semibold cursor-pointer"
                            >
                              {tr(lang, 'openBook')}
                            </button>
                          </div>
                        ))}
                    </div>

                    {/* Subject Tests */}
                    <div className="space-y-2.5">
                      <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                        20 savollik testlar
                      </h3>
                      {data.tests
                        .filter((t) => t.subjectId === activeSubject.id)
                        .map((t) => (
                          <div
                            key={t.id}
                            className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex flex-wrap items-center justify-between gap-2"
                          >
                            <div>
                              <p className="text-sm font-semibold">{t.title}</p>
                              <p className="text-xs text-slate-500">
                                {t.questions.length} savol · {t.durationMinutes} daqiqa
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => setActiveTest(t)}
                              className="min-h-[38px] px-3.5 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold cursor-pointer"
                            >
                              {tr(lang, 'startTest')}
                            </button>
                          </div>
                        ))}
                    </div>
                  </div>
                </div>
              )}

              {/* VIDEOS TAB */}
              {tab === 'videos' && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
                    <button
                      type="button"
                      onClick={() => switchSubject('all')}
                      className={`min-h-[38px] px-3 rounded-lg text-xs font-semibold border whitespace-nowrap shrink-0 cursor-pointer ${
                        selectedSubjectId === 'all'
                          ? 'border-sky-600 bg-sky-600 text-white'
                          : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900'
                      }`}
                    >
                      {tr(lang, 'allFilter')}
                    </button>
                    {subjects.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => switchSubject(s.id)}
                        className={`min-h-[38px] px-3 rounded-lg text-xs font-semibold border whitespace-nowrap shrink-0 cursor-pointer ${
                          selectedSubjectId === s.id
                            ? 'border-sky-600 bg-sky-600 text-white'
                            : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900'
                        }`}
                      >
                        {getSubjectTitle(s, lang)}
                      </button>
                    ))}
                  </div>

                  {activeVideo && (
                    <VideoLessonViewer
                      lesson={activeVideo}
                      onClose={() => setActiveVideo(null)}
                    />
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {data.videos
                      .filter(
                        (v) =>
                          selectedSubjectId === 'all' ||
                          v.subjectId === selectedSubjectId
                      )
                      .map((v) => {
                        const thumb = getYoutubeThumbnailUrl(v.videoUrl);
                        return (
                          <div
                            key={v.id}
                            className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden flex flex-col justify-between"
                          >
                            <div className="relative aspect-video bg-slate-900">
                              {thumb && (
                                <img
                                  src={thumb}
                                  alt={v.title}
                                  referrerPolicy="no-referrer"
                                  className="w-full h-full object-cover"
                                />
                              )}
                            </div>
                            <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                              <div>
                                <p className="text-sm font-bold text-slate-900 dark:text-white">
                                  {v.title}
                                </p>
                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                  {v.topic} · {v.durationMinutes} daq
                                </p>
                              </div>
                              <button
                                type="button"
                                onClick={() => setActiveVideo(v)}
                                className="w-full min-h-[40px] rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold inline-flex items-center justify-center gap-1.5 cursor-pointer"
                              >
                                <Play className="w-3.5 h-3.5" />
                                {tr(lang, 'watchInside')}
                              </button>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}

              {/* EBOOKS TAB */}
              {tab === 'ebooks' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {data.ebooks.map((book) => (
                    <div
                      key={book.id}
                      className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden flex flex-col"
                    >
                      <div className="aspect-[4/3] bg-slate-100 dark:bg-slate-800 overflow-hidden">
                        <img
                          src="/src/assets/images/ebook_cover_art_1795000758491.jpg"
                          alt={book.title}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                        <div>
                          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                            {book.title}
                          </h3>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
                            {book.summary}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setActiveBook(book)}
                          className="w-full min-h-[40px] rounded-xl bg-slate-900 dark:bg-sky-600 text-white text-xs font-semibold cursor-pointer"
                        >
                          {tr(lang, 'openBook')} (PDF)
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* HOMEWORK TAB */}
              {tab === 'homework' && (
                <div className="space-y-4">
                  {hwNotice && (
                    <div className="rounded-xl border border-sky-200 dark:border-sky-800 bg-sky-50 dark:bg-sky-950/50 p-3.5 text-xs font-medium text-sky-900 dark:text-sky-200">
                      {hwNotice}
                    </div>
                  )}

                  {data.homeworks.map((hw) => {
                    const sub = data.submissions.find((s) => s.homeworkId === hw.id);
                    const subj = subjects.find((s) => s.id === hw.subjectId);
                    return (
                      <div
                        key={hw.id}
                        className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 space-y-4"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                              {subj ? getSubjectTitle(subj, lang) : hw.subjectId} ·{' '}
                              {hw.topic} · Muddat:{' '}
                              {new Date(hw.deadline).toLocaleDateString('uz-UZ')}
                            </p>
                            <h3 className="text-base font-bold text-slate-900 dark:text-white mt-0.5">
                              {hw.title}
                            </h3>
                            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 mt-1">
                              {hw.description}
                            </p>
                          </div>
                          <div className="flex flex-col items-end gap-2">
                            {renderHomeworkStatusBadge(sub)}
                            <button
                              type="button"
                              onClick={() => setHelpHw(hw)}
                              className="min-h-[36px] px-3 py-1.5 rounded-lg border border-sky-200 dark:border-sky-800 bg-sky-50 dark:bg-sky-950/50 text-sky-700 dark:text-sky-300 text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                            >
                              <HelpCircle className="w-4 h-4" />
                              {tr(lang, 'homeworkHelp')}
                            </button>
                          </div>
                        </div>

                        {sub && (
                          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-3 text-xs space-y-1">
                            <p className="font-semibold">
                              Sizning javobingiz ({new Date(sub.submittedAt).toLocaleString('uz-UZ')}):
                            </p>
                            <p className="text-slate-600 dark:text-slate-300">{sub.answerText}</p>
                            {sub.attachmentUrl && (
                              <a
                                href={sub.attachmentUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-block text-sky-600 dark:text-sky-400 font-medium underline"
                              >
                                Yuklangan fayl: {sub.attachmentName || 'Faylni ko‘rish'}
                              </a>
                            )}
                            {sub.teacherComment && (
                              <p className="pt-1 text-slate-700 dark:text-slate-200">
                                <strong>{tr(lang, 'teacherComment')}:</strong> {sub.teacherComment}{' '}
                                {sub.mark5 ? `(Baho: ${sub.mark5} / ${sub.score}%)` : ''}
                              </p>
                            )}
                          </div>
                        )}

                        {(!sub || sub.status !== 'approved') && (
                          <div className="space-y-3 pt-2 border-t border-slate-200 dark:border-slate-800">
                            <textarea
                              rows={3}
                              value={answerMap[hw.id] ?? sub?.answerText ?? ''}
                              onChange={(e) =>
                                setAnswerMap((prev) => ({
                                  ...prev,
                                  [hw.id]: e.target.value,
                                }))
                              }
                              placeholder="Uy vazifasi javobini yozing..."
                              className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-sm"
                            />
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <label className="min-h-[40px] px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-medium inline-flex items-center gap-2 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800">
                                <Upload className="w-4 h-4" />
                                <span>
                                  {fileMap[hw.id]?.name || 'Rasm / PDF / fayl biriktirish'}
                                </span>
                                <input
                                  type="file"
                                  accept="image/*,.pdf,.doc,.docx,.txt"
                                  className="hidden"
                                  onChange={async (e) => {
                                    const f = e.target.files?.[0];
                                    if (!f) return;
                                    const b64 = await fileToBase64(f);
                                    setFileMap((prev) => ({
                                      ...prev,
                                      [hw.id]: { name: f.name, base64: b64 },
                                    }));
                                  }}
                                />
                              </label>

                              <button
                                type="button"
                                disabled={submittingHwId === hw.id}
                                onClick={() => handleSubmitHomework(hw.id)}
                                className="min-h-[42px] px-5 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold cursor-pointer disabled:opacity-50"
                              >
                                {submittingHwId === hw.id
                                  ? 'Yuborilmoqda...'
                                  : sub
                                  ? tr(lang, 'resubmitHomework')
                                  : tr(lang, 'submitHomework')}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* TESTS TAB */}
              {tab === 'tests' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {data.tests.map((test) => {
                    const lastRes = data.testResults.find(
                      (r) => r.testId === test.id
                    );
                    return (
                      <div
                        key={test.id}
                        className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 flex flex-col justify-between space-y-3"
                      >
                        <div>
                          <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                            {test.title}
                          </h3>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 tabular-nums">
                            {test.questions.length} savol · {test.durationMinutes} daqiqa
                            {lastRes ? ` · Oxirgi natija: ${lastRes.percentage}%` : ''}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setActiveTest(test)}
                          className="w-full min-h-[42px] rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold cursor-pointer"
                        >
                          {tr(lang, 'startTest')}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* GRADES TAB */}
              {tab === 'grades' && (
                <div className="space-y-4">
                  <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 space-y-3">
                    <h2 className="text-base font-bold">Test natijalari</h2>
                    {data.testResults.length === 0 ? (
                      <p className="text-xs text-slate-500">{tr(lang, 'noData')}</p>
                    ) : (
                      <div className="space-y-2">
                        {data.testResults.map((r) => (
                          <div
                            key={r.id}
                            className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex flex-wrap items-center justify-between gap-2 text-xs"
                          >
                            <div>
                              <p className="font-semibold text-slate-900 dark:text-white">
                                {r.testTitle}
                              </p>
                              <p className="text-slate-500">
                                {new Date(r.submittedAt).toLocaleString('uz-UZ')}
                              </p>
                            </div>
                            <span className="font-mono-num font-bold text-sm text-sky-600 dark:text-sky-400">
                              {r.correctCount}/{r.totalQuestions} ({r.percentage}%)
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 space-y-3">
                    <h2 className="text-base font-bold">Uy vazifalari baholari</h2>
                    {data.submissions.length === 0 ? (
                      <p className="text-xs text-slate-500">{tr(lang, 'noData')}</p>
                    ) : (
                      <div className="space-y-2">
                        {data.submissions.map((s) => (
                          <div
                            key={s.id}
                            className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex flex-wrap items-center justify-between gap-2 text-xs"
                          >
                            <div>
                              <p className="font-semibold">{s.topic}</p>
                              {s.teacherComment && (
                                <p className="text-slate-500">{s.teacherComment}</p>
                              )}
                            </div>
                            <div className="text-right">
                              {renderHomeworkStatusBadge(s)}
                              {s.mark5 && (
                                <p className="font-mono-num font-bold text-slate-900 dark:text-white mt-0.5">
                                  Baho: {s.mark5} ({s.score}%)
                                </p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* 12 LANGUAGES TAB */}
              {tab === 'languages' && <LanguageCenter lang={lang} />}

              {/* NOTIFICATIONS TAB */}
              {tab === 'notifications' && (
                <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <h2 className="text-base font-bold">{tr(lang, 'navNotifications')}</h2>
                    <button
                      type="button"
                      onClick={handleMarkNotificationsRead}
                      className="text-xs font-semibold text-sky-600 dark:text-sky-400 cursor-pointer"
                    >
                      Barchasini o‘qilgan deb belgilash
                    </button>
                  </div>
                  {data.notifications.length === 0 ? (
                    <p className="text-xs text-slate-500">{tr(lang, 'noData')}</p>
                  ) : (
                    data.notifications.map((n) => (
                      <div
                        key={n.id}
                        className={`p-3.5 rounded-xl border text-xs space-y-1 ${
                          n.read
                            ? 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950'
                            : 'border-sky-300 dark:border-sky-800 bg-sky-50/70 dark:bg-sky-950/30'
                        }`}
                      >
                        <p className="font-bold text-slate-900 dark:text-white">{n.title}</p>
                        <p className="text-slate-600 dark:text-slate-300">{n.message}</p>
                      </div>
                    ))
                  )}
                </div>
              )}
            </>
          ) : null}
        </main>
      </div>

      {/* Mobile Bottom Navigation (<= 15% height) */}
      <nav className="lg:hidden fixed bottom-0 inset-x-0 z-30 border-t border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xs px-1 py-1 flex items-center justify-around overflow-x-auto no-scrollbar">
        {navItems.slice(0, 6).map((item) => {
          const Icon = item.icon;
          const active = tab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => switchTab(item.id)}
              className={`min-h-[44px] px-2 py-1 flex flex-col items-center justify-center gap-0.5 text-[10px] font-semibold cursor-pointer ${
                active
                  ? 'text-sky-600 dark:text-sky-400'
                  : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span className="truncate max-w-[58px]">{item.label}</span>
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => switchTab('languages')}
          className={`min-h-[44px] px-2 py-1 flex flex-col items-center justify-center gap-0.5 text-[10px] font-semibold cursor-pointer ${
            tab === 'languages'
              ? 'text-sky-600 dark:text-sky-400'
              : 'text-slate-500 dark:text-slate-400'
          }`}
        >
          <Globe className="w-4 h-4" />
          <span>Tillar</span>
        </button>
      </nav>

      {/* Modals */}
      {activeVideo && tab !== 'videos' && (
        <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5">
          <div className="w-full max-w-3xl">
            <VideoLessonViewer
              lesson={activeVideo}
              onClose={() => setActiveVideo(null)}
            />
          </div>
        </div>
      )}

      {activeBook && (
        <PdfBookReader ebook={activeBook} onClose={() => setActiveBook(null)} />
      )}

      {activeTest && (
        <TestRunnerModal
          test={activeTest}
          lang={lang}
          onClose={() => setActiveTest(null)}
          onCompleted={() => loadDashboard()}
        />
      )}

      {helpHw && (
        <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5">
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-base font-bold">
                {tr(lang, 'homeworkHelp')}: {helpHw.title}
              </h3>
              <button
                type="button"
                onClick={() => setHelpHw(null)}
                className="min-h-[36px] min-w-[36px] inline-flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
              {helpHw.helpExplanation}
            </p>
            {helpHw.helpVideoUrl && (
              <VideoLessonViewer
                lesson={{
                  id: `help-${helpHw.id}`,
                  title: `Yordamchi video: ${helpHw.topic}`,
                  subjectId: helpHw.subjectId,
                  grade: helpHw.grade,
                  topic: helpHw.topic,
                  durationMinutes: 10,
                  videoUrl: helpHw.helpVideoUrl,
                  notes: helpHw.helpExplanation,
                  createdAt: '',
                }}
              />
            )}
            {helpHw.helpImageUrl && (
              <img
                src={helpHw.helpImageUrl}
                alt="Yordamchi rasm"
                className="w-full rounded-xl border border-slate-200 dark:border-slate-800"
              />
            )}
            {helpHw.helpPdfUrl && (
              <a
                href={helpHw.helpPdfUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 dark:bg-sky-600 text-white text-xs font-semibold"
              >
                <FileText className="w-4 h-4" />
                PDF qo‘llanmani ochish
              </a>
            )}
          </div>
        </div>
      )}

      {showSubModal && (
        <SubscriptionModal
          lang={lang}
          onClose={() => setShowSubModal(false)}
          onActivated={(updated) => {
            onUserUpdated(updated);
            setShowSubModal(false);
            loadDashboard();
          }}
        />
      )}
    </div>
  );
}
