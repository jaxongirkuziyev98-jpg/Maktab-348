import { useCallback, useEffect, useState } from 'react';
import {
  BarChart3,
  BookOpen,
  CheckCircle2,
  CreditCard,
  Globe,
  GraduationCap,
  LogOut,
  MessageSquare,
  Send,
  ShieldCheck,
  Upload,
  User as UserIcon,
  Users,
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
  IntegrationStatus,
  Lang,
  LanguageCourse,
  LanguageLevel,
  PaymentOrder,
  SchoolTest,
  SmsLogItem,
  SubjectInfo,
  TestAttemptResult,
  ThemeMode,
  UserProfile,
  VideoLesson,
} from '../types/lms.ts';
import { MiniColumnChart, SubjectProgressChart } from './Charts.tsx';
import { LanguageSwitcher } from './LanguageSwitcher.tsx';
import { ThemeToggleButton } from './ThemeToggleButton.tsx';

interface AdminCabinetProps {
  user: UserProfile;
  lang: Lang;
  onLangChange: (lang: Lang) => void;
  theme: ThemeMode;
  onToggleTheme: () => void;
  onLogout: () => void;
}

type AdminTab =
  | 'reports'
  | 'teachers'
  | 'students'
  | 'content'
  | 'payments'
  | 'sms';

interface AdminDashboardData {
  admin: UserProfile;
  users: UserProfile[];
  subjects: SubjectInfo[];
  videos: VideoLesson[];
  ebooks: Ebook[];
  homeworks: HomeworkAssignment[];
  submissions: HomeworkSubmission[];
  tests: SchoolTest[];
  testResults: TestAttemptResult[];
  payments: PaymentOrder[];
  smsLogs: SmsLogItem[];
  languageCourses: LanguageCourse[];
  integrationStatus: IntegrationStatus;
}

export function AdminCabinet({
  user,
  lang,
  onLangChange,
  theme,
  onToggleTheme,
  onLogout,
}: AdminCabinetProps) {
  const [tab, setTab] = useState<AdminTab>(
    () => getUiTabState('admin_tab', 'reports') as AdminTab
  );
  const [data, setData] = useState<AdminDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // New teacher form
  const [tFirst, setTFirst] = useState('');
  const [tLast, setTLast] = useState('');
  const [tPhone, setTPhone] = useState('+998');
  const [tEmail, setTEmail] = useState('');
  const [tPass, setTPass] = useState('teacher348');

  // New video lesson form
  const [vTitle, setVTitle] = useState('');
  const [vGrade, setVGrade] = useState(5);
  const [vSubject, setVSubject] = useState('math');
  const [vUrl, setVUrl] = useState('');
  const [vFile, setVFile] = useState<{ name: string; base64: string } | null>(null);

  // New e-book form
  const [bTitle, setBTitle] = useState('');
  const [bGrade, setBGrade] = useState(5);
  const [bSubject, setBSubject] = useState('math');
  const [bSummary, setBSummary] = useState('');
  const [bFile, setBFile] = useState<{ name: string; base64: string } | null>(null);

  // Language course video assignment
  const [lcId, setLcId] = useState('english');
  const [lcLevel, setLcLevel] = useState<LanguageLevel>('Beginner');
  const [lcUrl, setLcUrl] = useState('');
  const [lcFile, setLcFile] = useState<{ name: string; base64: string } | null>(null);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch<AdminDashboardData>('/api/admin/dashboard');
      setData(res);
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

  function switchTab(next: AdminTab) {
    setTab(next);
    saveUiTabState('admin_tab', next);
    setNotice(null);
  }

  async function handleCreateTeacher(e: React.FormEvent) {
    e.preventDefault();
    setNotice(null);
    setError(null);
    try {
      await apiFetch('/api/admin/teachers', {
        method: 'POST',
        body: JSON.stringify({
          firstName: tFirst,
          lastName: tLast,
          phone: tPhone,
          email: tEmail,
          password: tPass,
        }),
      });
      setTFirst('');
      setTLast('');
      setTPhone('+998');
      setTEmail('');
      setNotice('O‘qituvchi hisobi yaratildi ✓');
      await loadDashboard();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Xatolik');
    }
  }

  async function handleToggleGradeForTeacher(teacher: UserProfile, grade: number) {
    const current = teacher.assignedGrades || [];
    const next = current.includes(grade)
      ? current.filter((g) => g !== grade)
      : [...current, grade].sort((a, b) => a - b);
    await apiFetch(`/api/admin/teachers/${teacher.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ assignedGrades: next }),
    });
    await loadDashboard();
  }

  async function handleToggleSubjectForTeacher(teacher: UserProfile, subjectId: string) {
    const current = teacher.assignedSubjects || [];
    const next = current.includes(subjectId)
      ? current.filter((s) => s !== subjectId)
      : [...current, subjectId];
    await apiFetch(`/api/admin/teachers/${teacher.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ assignedSubjects: next }),
    });
    await loadDashboard();
  }

  async function handleToggleStudentSub(studentId: string, active: boolean) {
    await apiFetch(`/api/admin/students/${studentId}/subscription`, {
      method: 'PATCH',
      body: JSON.stringify({ active }),
    });
    setNotice(active ? 'Obuna 30 kunga faollashtirildi ✓' : 'Obuna to‘xtatildi');
    await loadDashboard();
  }

  async function handleAddVideo(e: React.FormEvent) {
    e.preventDefault();
    setNotice(null);
    setError(null);
    try {
      await apiFetch('/api/admin/videos', {
        method: 'POST',
        body: JSON.stringify({
          title: vTitle,
          grade: vGrade,
          subjectId: vSubject,
          videoUrl: vUrl,
          videoFileName: vFile?.name,
          videoBase64: vFile?.base64,
        }),
      });
      setVTitle('');
      setVUrl('');
      setVFile(null);
      setNotice('Video dars qo‘shildi ✓');
      await loadDashboard();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Video qo‘shishda xatolik');
    }
  }

  async function handleAddEbook(e: React.FormEvent) {
    e.preventDefault();
    setNotice(null);
    setError(null);
    try {
      await apiFetch('/api/admin/ebooks', {
        method: 'POST',
        body: JSON.stringify({
          title: bTitle,
          grade: bGrade,
          subjectId: bSubject,
          summary: bSummary,
          pdfFileName: bFile?.name,
          pdfBase64: bFile?.base64,
        }),
      });
      setBTitle('');
      setBSummary('');
      setBFile(null);
      setNotice('Elektron kitob qo‘shildi ✓');
      await loadDashboard();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kitob qo‘shishda xatolik');
    }
  }

  async function handleSaveLanguageVideo(e: React.FormEvent) {
    e.preventDefault();
    setNotice(null);
    setError(null);
    try {
      await apiFetch(`/api/admin/languages/${lcId}/${lcLevel}/video`, {
        method: 'PATCH',
        body: JSON.stringify({
          videoUrl: lcUrl,
          videoFileName: lcFile?.name,
          videoBase64: lcFile?.base64,
        }),
      });
      setLcUrl('');
      setLcFile(null);
      setNotice('Til kursi videosi yangilandi ✓');
      await loadDashboard();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Xatolik');
    }
  }

  async function handleVerifyPayment(orderId: string, approve: boolean) {
    await apiFetch(`/api/admin/payments/${orderId}/verify`, {
      method: 'PATCH',
      body: JSON.stringify({ approve }),
    });
    setNotice(approve ? 'To‘lov tasdiqlandi va obuna yoqildi ✓' : 'To‘lov rad etildi');
    await loadDashboard();
  }

  async function handleRunSmsScheduler() {
    const res = await apiFetch<{ count: number }>('/api/admin/sms/run-scheduler', {
      method: 'POST',
      body: JSON.stringify({ includeParents: true }),
    });
    setNotice(`SMS tekshiruvi tugadi: ${res.count} ta yangi xabarnoma qayd etildi.`);
    await loadDashboard();
  }

  const navItems: { id: AdminTab; label: string; icon: typeof BarChart3 }[] = [
    { id: 'reports', label: tr(lang, 'navReports'), icon: BarChart3 },
    { id: 'teachers', label: tr(lang, 'navTeachers'), icon: Users },
    { id: 'students', label: tr(lang, 'navStudents'), icon: GraduationCap },
    { id: 'content', label: tr(lang, 'navContent'), icon: BookOpen },
    { id: 'payments', label: tr(lang, 'navPayments'), icon: CreditCard },
    { id: 'sms', label: tr(lang, 'navSms'), icon: MessageSquare },
  ];

  const students = data?.users.filter((u) => u.role === 'student') || [];
  const teachers = data?.users.filter((u) => u.role === 'teacher') || [];
  const paidOrders = data?.payments.filter((p) => p.status === 'paid') || [];
  const totalRevenue = paidOrders.reduce((acc, p) => acc + p.amount, 0);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col pb-16 lg:pb-0">
      <header className="sticky top-0 z-30 border-b border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xs px-4 sm:px-6 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <span className="text-base sm:text-lg font-extrabold tracking-tight whitespace-nowrap shrink-0">
              {tr(lang, 'brand')}
            </span>
            <span className="hidden sm:inline text-xs text-slate-500 dark:text-slate-400 truncate">
              {tr(lang, 'adminRole')} · {user.firstName} {user.lastName}
            </span>
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
        <aside className="hidden lg:flex flex-col w-60 shrink-0 space-y-1">
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
                    ? 'bg-slate-900 dark:bg-sky-600 text-white'
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
              Administrator boshqaruv paneli yuklanmoqda...
            </div>
          ) : data ? (
            <>
              {/* REPORTS & OVERVIEW */}
              {tab === 'reports' && (
                <div className="space-y-5">
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
                      <p className="text-xs text-slate-500">Jami o‘quvchilar</p>
                      <p className="text-2xl font-bold font-mono-num mt-1">{students.length}</p>
                    </div>
                    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
                      <p className="text-xs text-slate-500">O‘qituvchilar</p>
                      <p className="text-2xl font-bold font-mono-num mt-1">{teachers.length}</p>
                    </div>
                    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
                      <p className="text-xs text-slate-500">Video / Kitob / Test</p>
                      <p className="text-xl font-bold font-mono-num mt-1">
                        {data.videos.length} / {data.ebooks.length} / {data.tests.length}
                      </p>
                    </div>
                    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
                      <p className="text-xs text-slate-500">Tasdiqlangan to‘lovlar</p>
                      <p className="text-xl font-bold font-mono-num text-emerald-600 mt-1">
                        {totalRevenue.toLocaleString()} so‘m
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <MiniColumnChart
                      title="Sinflar bo‘yicha o‘quvchilar"
                      bars={[1, 3, 5, 8, 9, 11].map((g) => ({
                        label: `${g}-s`,
                        value: students.filter((s) => s.grade === g).length,
                      }))}
                    />
                    <SubjectProgressChart
                      title="Maktab fanlari qamrovi"
                      data={data.subjects.slice(0, 6).map((s) => ({
                        label: getSubjectTitle(s, lang),
                        value: data.videos.filter((v) => v.subjectId === s.id).length * 9,
                        max: 100,
                        sublabel: `${data.videos.filter((v) => v.subjectId === s.id).length} video`,
                      }))}
                    />
                  </div>
                </div>
              )}

              {/* TEACHERS TAB */}
              {tab === 'teachers' && (
                <div className="space-y-5">
                  <form
                    onSubmit={handleCreateTeacher}
                    className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-3"
                  >
                    <h2 className="text-base font-bold">Yangi o‘qituvchi qo‘shish</h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
                      <input
                        type="text"
                        required
                        value={tFirst}
                        onChange={(e) => setTFirst(e.target.value)}
                        placeholder="Ism"
                        className="min-h-[40px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs"
                      />
                      <input
                        type="text"
                        required
                        value={tLast}
                        onChange={(e) => setTLast(e.target.value)}
                        placeholder="Familiya"
                        className="min-h-[40px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs"
                      />
                      <input
                        type="tel"
                        required
                        value={tPhone}
                        onChange={(e) => setTPhone(e.target.value)}
                        placeholder="+99890..."
                        className="min-h-[40px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs font-mono-num"
                      />
                      <input
                        type="email"
                        value={tEmail}
                        onChange={(e) => setTEmail(e.target.value)}
                        placeholder="Gmail"
                        className="min-h-[40px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs"
                      />
                      <button
                        type="submit"
                        className="min-h-[40px] px-4 rounded-xl bg-sky-600 text-white text-xs font-semibold cursor-pointer"
                      >
                        Qo‘shish
                      </button>
                    </div>
                  </form>

                  <div className="space-y-3">
                    {teachers.map((t) => (
                      <div
                        key={t.id}
                        className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-3"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2.5">
                            {t.avatarUrl ? (
                              <img
                                src={t.avatarUrl}
                                alt={`${t.firstName} ${t.lastName}`}
                                className="w-10 h-10 rounded-full object-cover border-2 border-emerald-500"
                              />
                            ) : (
                              <span className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 inline-flex items-center justify-center">
                                <UserIcon className="w-4 h-4" />
                              </span>
                            )}
                            <div>
                              <p className="text-sm font-bold">
                                {t.firstName} {t.lastName}
                              </p>
                              <p className="text-xs text-slate-500 font-mono-num">
                                {t.phone} · {t.email || 'Gmail kiritilmagan'}
                              </p>
                            </div>
                          </div>
                          <span className="text-xs font-semibold text-emerald-600">
                            {t.faceVerified ? 'Yuz tasdiqlangan ✓' : 'Yuz kutilmoqda'}
                          </span>
                        </div>

                        <div className="space-y-1.5">
                          <p className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                            Biriktirilgan sinflar (1–11):
                          </p>
                          <div className="flex flex-wrap gap-1.5">
                            {Array.from({ length: 11 }, (_, i) => i + 1).map((g) => {
                              const on = (t.assignedGrades || []).includes(g);
                              return (
                                <button
                                  key={g}
                                  type="button"
                                  onClick={() => handleToggleGradeForTeacher(t, g)}
                                  className={`w-8 h-8 rounded-lg text-xs font-mono-num font-semibold border cursor-pointer ${
                                    on
                                      ? 'border-sky-600 bg-sky-600 text-white'
                                      : 'border-slate-200 dark:border-slate-700'
                                  }`}
                                >
                                  {g}
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        <div className="space-y-1.5">
                          <p className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                            Biriktirilgan fanlar:
                          </p>
                          <div className="flex flex-wrap gap-1.5">
                            {data.subjects.map((s) => {
                              const on = (t.assignedSubjects || []).includes(s.id);
                              return (
                                <button
                                  key={s.id}
                                  type="button"
                                  onClick={() => handleToggleSubjectForTeacher(t, s.id)}
                                  className={`px-2.5 py-1 rounded-lg text-xs font-medium border cursor-pointer ${
                                    on
                                      ? 'border-emerald-600 bg-emerald-600 text-white'
                                      : 'border-slate-200 dark:border-slate-700'
                                  }`}
                                >
                                  {getSubjectTitle(s, lang)}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* STUDENTS TAB */}
              {tab === 'students' && (
                <div className="space-y-3">
                  <h2 className="text-lg font-bold">{tr(lang, 'navStudents')} ({students.length})</h2>
                  {students.map((s) => {
                    const active =
                      Boolean(s.subscriptionExpiresAt) &&
                      new Date(s.subscriptionExpiresAt!).getTime() > Date.now();
                    return (
                      <div
                        key={s.id}
                        className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 flex flex-wrap items-center justify-between gap-3"
                      >
                        <div>
                          <p className="text-sm font-bold">
                            {s.firstName} {s.lastName} · {s.grade}-sinf
                          </p>
                          <p className="text-xs text-slate-500 font-mono-num">
                            {s.phone} {s.parentPhone ? `· Ota-ona: ${s.parentPhone}` : ''}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span
                            className={`text-xs font-semibold ${
                              active ? 'text-emerald-600' : 'text-rose-600'
                            }`}
                          >
                            {active ? 'Obuna faol ✓' : 'Obuna nofaol'}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleToggleStudentSub(s.id, !active)}
                            className="min-h-[36px] px-3 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold cursor-pointer"
                          >
                            {active ? 'To‘xtatish' : '30 kun yoqish'}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* CONTENT & 12 LANGUAGE COURSES TAB */}
              {tab === 'content' && (
                <div className="space-y-5">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <form
                      onSubmit={handleAddVideo}
                      className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-3"
                    >
                      <h3 className="text-sm font-bold">Video dars qo‘shish</h3>
                      <input
                        type="text"
                        required
                        value={vTitle}
                        onChange={(e) => setVTitle(e.target.value)}
                        placeholder="Video dars nomi"
                        className="w-full min-h-[40px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs"
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <select
                          value={vGrade}
                          onChange={(e) => setVGrade(Number(e.target.value))}
                          className="min-h-[40px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs"
                        >
                          {Array.from({ length: 11 }, (_, i) => i + 1).map((g) => (
                            <option key={g} value={g}>
                              {g}-sinf
                            </option>
                          ))}
                        </select>
                        <select
                          value={vSubject}
                          onChange={(e) => setVSubject(e.target.value)}
                          className="min-h-[40px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs"
                        >
                          {data.subjects.map((s) => (
                            <option key={s.id} value={s.id}>
                              {getSubjectTitle(s, lang)}
                            </option>
                          ))}
                        </select>
                      </div>
                      <input
                        type="url"
                        value={vUrl}
                        onChange={(e) => setVUrl(e.target.value)}
                        placeholder="YouTube yoki rasmiy video havola"
                        className="w-full min-h-[40px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs"
                      />
                      <label className="min-h-[38px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 text-xs inline-flex items-center gap-2 cursor-pointer">
                        <Upload className="w-4 h-4" />
                        <span>{vFile?.name || 'Yoki MP4/WebM video yuklash'}</span>
                        <input
                          type="file"
                          accept="video/mp4,video/webm"
                          className="hidden"
                          onChange={async (e) => {
                            const f = e.target.files?.[0];
                            if (!f) return;
                            setVFile({ name: f.name, base64: await fileToBase64(f) });
                          }}
                        />
                      </label>
                      <button
                        type="submit"
                        className="w-full min-h-[40px] rounded-xl bg-sky-600 text-white text-xs font-semibold cursor-pointer"
                      >
                        Video darsni saqlash
                      </button>
                    </form>

                    <form
                      onSubmit={handleAddEbook}
                      className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-3"
                    >
                      <h3 className="text-sm font-bold">Elektron kitob (PDF) qo‘shish</h3>
                      <input
                        type="text"
                        required
                        value={bTitle}
                        onChange={(e) => setBTitle(e.target.value)}
                        placeholder="Kitob nomi"
                        className="w-full min-h-[40px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs"
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <select
                          value={bGrade}
                          onChange={(e) => setBGrade(Number(e.target.value))}
                          className="min-h-[40px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs"
                        >
                          {Array.from({ length: 11 }, (_, i) => i + 1).map((g) => (
                            <option key={g} value={g}>
                              {g}-sinf
                            </option>
                          ))}
                        </select>
                        <select
                          value={bSubject}
                          onChange={(e) => setBSubject(e.target.value)}
                          className="min-h-[40px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs"
                        >
                          {data.subjects.map((s) => (
                            <option key={s.id} value={s.id}>
                              {getSubjectTitle(s, lang)}
                            </option>
                          ))}
                        </select>
                      </div>
                      <input
                        type="text"
                        value={bSummary}
                        onChange={(e) => setBSummary(e.target.value)}
                        placeholder="Qisqacha tavsif"
                        className="w-full min-h-[40px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs"
                      />
                      <label className="min-h-[38px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 text-xs inline-flex items-center gap-2 cursor-pointer">
                        <Upload className="w-4 h-4" />
                        <span>{bFile?.name || 'PDF fayl yuklash (ixtiyoriy)'}</span>
                        <input
                          type="file"
                          accept=".pdf"
                          className="hidden"
                          onChange={async (e) => {
                            const f = e.target.files?.[0];
                            if (!f) return;
                            setBFile({ name: f.name, base64: await fileToBase64(f) });
                          }}
                        />
                      </label>
                      <button
                        type="submit"
                        className="w-full min-h-[40px] rounded-xl bg-slate-900 dark:bg-sky-600 text-white text-xs font-semibold cursor-pointer"
                      >
                        Kitobni qo‘shish
                      </button>
                    </form>
                  </div>

                  {/* 12 Language Courses Video Management */}
                  <form
                    onSubmit={handleSaveLanguageVideo}
                    className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-3"
                  >
                    <h3 className="text-sm font-bold flex items-center gap-2">
                      <Globe className="w-4 h-4 text-sky-600" />
                      12 ta til kursi uchun video yuklash yoki rasmiy havola biriktirish
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                      <select
                        value={lcId}
                        onChange={(e) => setLcId(e.target.value)}
                        className="min-h-[40px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs"
                      >
                        {data.languageCourses.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.nameUz}
                          </option>
                        ))}
                      </select>
                      <select
                        value={lcLevel}
                        onChange={(e) => setLcLevel(e.target.value as LanguageLevel)}
                        className="min-h-[40px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs"
                      >
                        <option value="Beginner">Beginner</option>
                        <option value="Intermediate">Intermediate</option>
                        <option value="Advanced">Advanced</option>
                      </select>
                      <input
                        type="url"
                        value={lcUrl}
                        onChange={(e) => setLcUrl(e.target.value)}
                        placeholder="Rasmiy YouTube video havola"
                        className="min-h-[40px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs"
                      />
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <label className="min-h-[38px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 text-xs inline-flex items-center gap-2 cursor-pointer">
                        <Upload className="w-4 h-4" />
                        <span>{lcFile?.name || 'Yoki video fayl yuklash'}</span>
                        <input
                          type="file"
                          accept="video/mp4,video/webm"
                          className="hidden"
                          onChange={async (e) => {
                            const f = e.target.files?.[0];
                            if (!f) return;
                            setLcFile({ name: f.name, base64: await fileToBase64(f) });
                          }}
                        />
                      </label>
                      <button
                        type="submit"
                        className="min-h-[40px] px-5 rounded-xl bg-sky-600 text-white text-xs font-semibold cursor-pointer"
                      >
                        Til videosini yangilash
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* PAYMENTS & CLICK MERCHANT TAB */}
              {tab === 'payments' && (
                <div className="space-y-4">
                  <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <h2 className="text-base font-bold flex items-center gap-2">
                        <ShieldCheck className="w-4 h-4 text-sky-600" />
                        Click Merchant API integratsiya holati
                      </h2>
                      <span
                        className={`text-xs font-bold ${
                          data.integrationStatus.clickConfigured
                            ? 'text-emerald-600'
                            : 'text-amber-600'
                        }`}
                      >
                        {data.integrationStatus.clickConfigured ? 'LIVE ULANGAN ✓' : 'DEMO REJIM'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-300">
                      Qabul qiluvchi karta: <strong className="font-mono-num">{data.integrationStatus.recipientCard}</strong> · Narx:{' '}
                      <strong className="font-mono-num">10 000 so‘m / 30 kun</strong>
                    </p>
                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-[11px] font-mono-num space-y-1">
                      <p>Prepare URL: {data.integrationStatus.webhookUrls.clickPrepare}</p>
                      <p>Complete URL: {data.integrationStatus.webhookUrls.clickComplete}</p>
                    </div>
                  </div>

                  <div className="space-y-2.5">
                    {data.payments.length === 0 ? (
                      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 text-xs text-slate-500">
                        Hali to‘lov tranzaksiyalari mavjud emas.
                      </div>
                    ) : (
                      data.payments.map((p) => (
                        <div
                          key={p.id}
                          className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 flex flex-wrap items-center justify-between gap-3 text-xs"
                        >
                          <div>
                            <p className="font-bold">
                              {p.userName} ({p.userPhone}) —{' '}
                              <span className="font-mono-num">{p.amount.toLocaleString()} so‘m</span>
                            </p>
                            <p className="text-slate-500">
                              {p.provider.toUpperCase()} · {p.mode} · {p.id}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <span
                              className={`font-semibold ${
                                p.status === 'paid'
                                  ? 'text-emerald-600'
                                  : p.status === 'failed'
                                  ? 'text-rose-600'
                                  : 'text-amber-600'
                              }`}
                            >
                              {p.status === 'paid'
                                ? 'Qabul qilindi ✓'
                                : p.status === 'pending' || p.status === 'pending_verification'
                                ? 'To‘lov kutilmoqda'
                                : 'Rad etilgan'}
                            </span>
                            {(p.status === 'pending' || p.status === 'pending_verification') && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => handleVerifyPayment(p.id, true)}
                                  className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white font-semibold cursor-pointer"
                                >
                                  Tasdiqlash ✓
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleVerifyPayment(p.id, false)}
                                  className="px-3 py-1.5 rounded-lg border border-rose-300 text-rose-600 font-semibold cursor-pointer"
                                >
                                  Rad etish
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* SMS SCHEDULER TAB */}
              {tab === 'sms' && (
                <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h2 className="text-base font-bold">
                        SMS Gateway ({data.integrationStatus.smsConfigured ? 'LIVE ULANGAN ✓' : 'DEMO REJIM'})
                      </h2>
                      <p className="text-xs text-slate-500">
                        Muddati o‘tgan uy vazifalari uchun o‘quvchilar va ota-onalarga eslatma yuborish
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleRunSmsScheduler}
                      className="min-h-[40px] px-4 rounded-xl bg-sky-600 text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <Send className="w-3.5 h-3.5" />
                      Scheduler ni ishga tushirish
                    </button>
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
                              {log.studentName} · {log.phone} ({log.target})
                            </span>
                            <span className="font-mono-num text-slate-500">
                              {log.status} · {new Date(log.sentAt).toLocaleString('uz-UZ')}
                            </span>
                          </div>
                          <p className="text-slate-600 dark:text-slate-300">{log.message}</p>
                        </div>
                      ))}
                    </div>
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
                  ? 'text-sky-600 dark:text-sky-400'
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
