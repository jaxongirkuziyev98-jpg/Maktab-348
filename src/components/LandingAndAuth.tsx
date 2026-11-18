import { useState } from 'react';
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  GraduationCap,
  ShieldCheck,
  Smartphone,
  Sparkles,
  UserCheck,
} from 'lucide-react';
import { tr } from '../i18n/translations.ts';
import { ApiError, apiFetch } from '../lib/api.ts';
import type { Lang, ThemeMode, UserProfile, UserRole } from '../types/lms.ts';
import { LanguageSwitcher } from './LanguageSwitcher.tsx';
import { ThemeToggleButton } from './ThemeToggleButton.tsx';

interface LandingAndAuthProps {
  lang: Lang;
  onLangChange: (lang: Lang) => void;
  theme: ThemeMode;
  onToggleTheme: () => void;
  onAuthenticated: (token: string, user: UserProfile) => void;
}

const DEMO_ACCOUNTS = [
  {
    label: 'Madina Olimova · 3-sinf (O‘yinli dizayn)',
    phone: '+998903000003',
    role: 'O‘quvchi',
  },
  {
    label: 'Sardorbek Alimov · 9-sinf (Minimalistik)',
    phone: '+998903000009',
    role: 'O‘quvchi',
  },
  {
    label: 'Azizbek Tursunov · 8-sinf (To‘lov oynasi)',
    phone: '+998903000008',
    role: 'O‘quvchi',
  },
  {
    label: 'Malika Rustamova · Matematika/IT',
    phone: '+998902000001',
    role: 'O‘qituvchi',
  },
  {
    label: 'Dilshod Raximov · Maktab direktori',
    phone: '+998901000001',
    role: 'Administrator',
  },
];

export function LandingAndAuth({
  lang,
  onLangChange,
  theme,
  onToggleTheme,
  onAuthenticated,
}: LandingAndAuthProps) {
  const [authMode, setAuthMode] = useState<'register' | 'login'>('register');
  const [regRole, setRegRole] = useState<'student' | 'teacher'>('student');
  const [loginRole, setLoginRole] = useState<UserRole>('student');

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [grade, setGrade] = useState(5);
  const [phone, setPhone] = useState('+998');
  const [parentPhone, setParentPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [smsCode, setSmsCode] = useState('');
  const [smsSentNote, setSmsSentNote] = useState<string | null>(null);
  const [demoSmsCode, setDemoSmsCode] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [alreadyRegisteredPhone, setAlreadyRegisteredPhone] = useState<string | null>(null);

  async function handleSendSms() {
    setError(null);
    setSmsSentNote(null);
    setDemoSmsCode(null);
    try {
      const res = await apiFetch<{
        ok: boolean;
        smsConfigured: boolean;
        demoCode?: string;
        message: string;
      }>('/api/auth/send-sms', {
        method: 'POST',
        body: JSON.stringify({ phone }),
      });
      setSmsSentNote(res.message);
      if (res.demoCode) {
        setDemoSmsCode(res.demoCode);
        setSmsCode(res.demoCode);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'SMS yuborishda xatolik');
    }
  }

  async function handleRegisterSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setAlreadyRegisteredPhone(null);
    try {
      const res = await apiFetch<{ token: string; user: UserProfile }>(
        '/api/auth/register',
        {
          method: 'POST',
          body: JSON.stringify({
            role: regRole,
            firstName,
            lastName,
            grade: regRole === 'student' ? grade : undefined,
            phone,
            parentPhone: regRole === 'student' ? parentPhone : undefined,
            email: regRole === 'teacher' ? email : undefined,
            password,
            smsCode,
          }),
        }
      );
      onAuthenticated(res.token, res.user);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409 && err.data?.alreadyExists) {
        setAlreadyRegisteredPhone(phone);
      }
      setError(err instanceof Error ? err.message : 'Ro‘yxatdan o‘tishda xatolik');
    } finally {
      setLoading(false);
    }
  }

  async function handleLoginSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch<{ token: string; user: UserProfile }>(
        '/api/auth/login',
        {
          method: 'POST',
          body: JSON.stringify({
            phone,
            password,
            role: loginRole,
          }),
        }
      );
      onAuthenticated(res.token, res.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kirishda xatolik');
    } finally {
      setLoading(false);
    }
  }

  async function handleQuickOpenExistingStudent() {
    if (!alreadyRegisteredPhone) return;
    setLoading(true);
    try {
      const res = await apiFetch<{ token: string; user: UserProfile }>(
        '/api/auth/quick-open-student',
        {
          method: 'POST',
          body: JSON.stringify({ phone: alreadyRegisteredPhone }),
        }
      );
      onAuthenticated(res.token, res.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Hisobni ochishda xatolik');
    } finally {
      setLoading(false);
    }
  }

  async function handleQuickDemo(demoPhone: string) {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch<{ token: string; user: UserProfile }>(
        '/api/auth/quick-demo',
        {
          method: 'POST',
          body: JSON.stringify({ phone: demoPhone }),
        }
      );
      onAuthenticated(res.token, res.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kirishda xatolik');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col">
      {/* Clean 3-Zone Top Bar */}
      <header className="sticky top-0 z-30 border-b border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xs px-4 sm:px-6 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <a
            href="#top"
            className="text-lg sm:text-xl font-extrabold tracking-tight text-slate-900 dark:text-white whitespace-nowrap shrink-0"
          >
            {tr(lang, 'brand')}
          </a>

          <nav className="hidden lg:flex items-center gap-6 text-sm font-medium text-slate-600 dark:text-slate-300">
            <a href="#portal" className="hover:text-slate-900 dark:hover:text-white whitespace-nowrap">
              {tr(lang, 'registerTab')}
            </a>
            <a href="#features" className="hover:text-slate-900 dark:hover:text-white whitespace-nowrap">
              1–11-sinf LMS
            </a>
            <a href="#languages" className="hover:text-slate-900 dark:hover:text-white whitespace-nowrap">
              {tr(lang, 'navLanguages')}
            </a>
          </nav>

          <div className="flex items-center gap-2 shrink-0">
            <LanguageSwitcher lang={lang} onChange={onLangChange} />
            <ThemeToggleButton theme={theme} onToggle={onToggleTheme} lang={lang} />
          </div>
        </div>
      </header>

      <main id="portal" className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-10 space-y-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
          {/* Left: Unified Registration / Login Portal */}
          <div className="lg:col-span-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 sm:p-7 shadow-xs space-y-5">
            <div className="space-y-1">
              <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight text-balance">
                {tr(lang, 'brand')}
              </h1>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">
                {tr(lang, 'tagline')}
              </p>
            </div>

            {/* Single Switcher: Ro'yxatdan o'tish | Tizimga kirish */}
            <div className="grid grid-cols-2 p-1 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
              <button
                type="button"
                onClick={() => {
                  setAuthMode('register');
                  setError(null);
                }}
                className={`min-h-[42px] rounded-lg text-xs sm:text-sm font-semibold transition-colors cursor-pointer ${
                  authMode === 'register'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                {tr(lang, 'registerTab')}
              </button>
              <button
                type="button"
                onClick={() => {
                  setAuthMode('login');
                  setError(null);
                }}
                className={`min-h-[42px] rounded-lg text-xs sm:text-sm font-semibold transition-colors cursor-pointer ${
                  authMode === 'login'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                {tr(lang, 'loginTab')}
              </button>
            </div>

            {authMode === 'register' ? (
              <form onSubmit={handleRegisterSubmit} className="space-y-4">
                {/* Only Student and Teacher selectable in Registration */}
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setRegRole('student')}
                    className={`min-h-[48px] px-3 py-2 rounded-xl border text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 cursor-pointer transition-colors ${
                      regRole === 'student'
                        ? 'border-sky-600 bg-sky-50 dark:bg-sky-950/60 text-sky-800 dark:text-sky-200'
                        : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    <GraduationCap className="w-4 h-4" />
                    {tr(lang, 'studentRole')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setRegRole('teacher')}
                    className={`min-h-[48px] px-3 py-2 rounded-xl border text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 cursor-pointer transition-colors ${
                      regRole === 'teacher'
                        ? 'border-emerald-600 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-200'
                        : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    <UserCheck className="w-4 h-4" />
                    {tr(lang, 'teacherRole')}
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                      {tr(lang, 'firstName')}
                    </label>
                    <input
                      type="text"
                      required
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      placeholder="Ismingiz"
                      className="w-full min-h-[44px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                      {tr(lang, 'lastName')}
                    </label>
                    <input
                      type="text"
                      required
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      placeholder="Familiyangiz"
                      className="w-full min-h-[44px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-sm"
                    />
                  </div>
                </div>

                {regRole === 'student' ? (
                  <>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                        {tr(lang, 'gradeSelect')}
                      </label>
                      <select
                        value={grade}
                        onChange={(e) => setGrade(Number(e.target.value))}
                        className="w-full min-h-[44px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-sm"
                      >
                        {Array.from({ length: 11 }, (_, i) => i + 1).map((g) => (
                          <option key={g} value={g}>
                            {g}-{tr(lang, 'gradeLabel')} {g <= 4 ? '(Boshlang‘ich o‘yinli)' : '(Akademik)'}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                          {tr(lang, 'parentPhoneLabel')}
                        </label>
                        <input
                          type="tel"
                          value={parentPhone}
                          onChange={(e) => setParentPhone(e.target.value)}
                          placeholder="+99890..."
                          className="w-full min-h-[44px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-sm font-mono-num"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                          {tr(lang, 'passwordOptionalLabel')}
                        </label>
                        <input
                          type="password"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="Ixtiyoriy"
                          className="w-full min-h-[44px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-sm"
                        />
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                        {tr(lang, 'emailLabel')}
                      </label>
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="example@gmail.com"
                        className="w-full min-h-[44px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                        {tr(lang, 'passwordLabel')}
                      </label>
                      <input
                        type="password"
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Kamida 4 belgi"
                        className="w-full min-h-[44px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-sm"
                      />
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    {tr(lang, 'phoneLabel')}
                  </label>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      type="tel"
                      required
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+998901234567"
                      className="flex-1 min-h-[44px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-sm font-mono-num"
                    />
                    <button
                      type="button"
                      onClick={handleSendSms}
                      className="min-h-[44px] px-4 rounded-xl border border-sky-600 text-sky-700 dark:text-sky-300 hover:bg-sky-50 dark:hover:bg-sky-950 text-xs font-semibold inline-flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
                    >
                      <Smartphone className="w-4 h-4" />
                      {tr(lang, 'sendSmsBtn')}
                    </button>
                  </div>
                </div>

                {smsSentNote && (
                  <div className="rounded-xl border border-sky-200 dark:border-sky-800 bg-sky-50 dark:bg-sky-950/50 p-3 text-xs text-sky-900 dark:text-sky-200">
                    {smsSentNote}
                    {demoSmsCode && (
                      <span className="ml-1.5 font-mono-num font-bold">
                        ({demoSmsCode})
                      </span>
                    )}
                  </div>
                )}

                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    {tr(lang, 'smsCodeLabel')}
                  </label>
                  <input
                    type="text"
                    required
                    value={smsCode}
                    onChange={(e) => setSmsCode(e.target.value)}
                    placeholder="6 xonali kod"
                    className="w-full min-h-[44px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-sm font-mono-num"
                  />
                </div>

                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {regRole === 'student'
                    ? 'O‘quvchi ro‘yxatdan o‘tgach 30 kunlik obuna (10 000 so‘m) to‘lov oynasi ochiladi.'
                    : 'O‘qituvchi uchun bepul: ro‘yxatdan o‘tgach dumaloq kamera orqali yuzingizni tasdiqlab darhol kabinetga kirasiz.'}
                </p>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full min-h-[46px] px-5 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-sm font-semibold inline-flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <span>{loading ? 'Yuborilmoqda...' : tr(lang, 'registerSubmit')}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </form>
            ) : (
              <form onSubmit={handleLoginSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setLoginRole('student')}
                    className={`min-h-[44px] rounded-xl border text-xs sm:text-sm font-semibold cursor-pointer ${
                      loginRole === 'student'
                        ? 'border-sky-600 bg-sky-50 dark:bg-sky-950/60 text-sky-800 dark:text-sky-200'
                        : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    {tr(lang, 'studentRole')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setLoginRole('teacher')}
                    className={`min-h-[44px] rounded-xl border text-xs sm:text-sm font-semibold cursor-pointer ${
                      loginRole === 'teacher'
                        ? 'border-emerald-600 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-200'
                        : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    {tr(lang, 'teacherRole')}
                  </button>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    {tr(lang, 'phoneLabel')}
                  </label>
                  <input
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+998902000001"
                    className="w-full min-h-[44px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-sm font-mono-num"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    {loginRole === 'student'
                      ? tr(lang, 'passwordOptionalLabel')
                      : tr(lang, 'passwordLabel')}
                  </label>
                  <input
                    type="password"
                    required={loginRole !== 'student'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••"
                    className="w-full min-h-[44px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-sm"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full min-h-[46px] px-5 py-2.5 rounded-xl bg-slate-900 dark:bg-sky-600 hover:opacity-95 text-white text-sm font-semibold inline-flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>{tr(lang, 'loginSubmit')}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>

                <div className="pt-1 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                  <button
                    type="button"
                    onClick={() => setLoginRole('admin')}
                    className={`hover:underline cursor-pointer ${
                      loginRole === 'admin' ? 'font-bold text-sky-600 dark:text-sky-400' : ''
                    }`}
                  >
                    {tr(lang, 'adminRole')} kirishi
                  </button>
                  <button
                    type="button"
                    onClick={() => setAuthMode('register')}
                    className="hover:underline cursor-pointer"
                  >
                    ← {tr(lang, 'registerTab')}
                  </button>
                </div>
              </form>
            )}

            {error && (
              <div className="rounded-xl border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/40 p-3 text-xs text-rose-700 dark:text-rose-300 space-y-2">
                <p>{error}</p>
                {alreadyRegisteredPhone && (
                  <button
                    type="button"
                    onClick={handleQuickOpenExistingStudent}
                    className="px-3 py-1.5 rounded-lg bg-sky-600 text-white font-semibold cursor-pointer"
                  >
                    {alreadyRegisteredPhone} hisobini darhol ochish →
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Right: Campus Visual + Quick Role Testing */}
          <div className="lg:col-span-6 space-y-5">
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-xs">
              <div className="relative aspect-video bg-slate-200 dark:bg-slate-800">
                <img
                  src="/src/assets/images/hero_school_campus_1795000758283.jpg"
                  alt="348-MAKTAB raqamli o‘quv studiyasi"
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-950/20 to-transparent flex items-end p-5">
                  <div className="text-white space-y-1">
                    <p className="text-xs font-medium text-sky-300">
                      O‘zbek · Rus · Ingliz · 1–11-sinflar
                    </p>
                    <h2 className="text-lg sm:text-xl font-bold">
                      Video darslar, PDF kitoblar, uy vazifasi va 20 savollik testlar
                    </h2>
                  </div>
                </div>
              </div>

              <div className="p-5 space-y-3">
                <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  {tr(lang, 'quickDemoAccess')}
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {DEMO_ACCOUNTS.map((acc) => (
                    <button
                      key={acc.phone}
                      type="button"
                      disabled={loading}
                      onClick={() => handleQuickDemo(acc.phone)}
                      className="min-h-[44px] px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 hover:border-sky-500 text-left transition-colors cursor-pointer"
                    >
                      <p className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                        {acc.label}
                      </p>
                      <p className="text-[11px] font-mono-num text-slate-500 dark:text-slate-400">
                        {acc.role} · {acc.phone}
                      </p>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Platform Capabilities Overview */}
        <section id="features" className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-2">
            <Sparkles className="w-5 h-5 text-amber-500" />
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              1–4 va 5–11-sinf dizayni
            </h3>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              Boshlang‘ich sinflar uchun yulduzchalar va medalli o‘yin muhiti, yuqori sinflar uchun esa minimalistik akademik tahlil paneli.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              O‘qituvchi nazorati va 20 savollik test
            </h3>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              Vazifalar faqat o‘qituvchi tekshirganidan keyin tasdiqlanadi ✓. Testlar avtomatik tekshirilib batafsil izoh beradi.
            </p>
          </div>

          <div id="languages" className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-2">
            <BookOpen className="w-5 h-5 text-sky-600" />
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              12 ta til kursi va SMS eslatmalar
            </h3>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              Ingliz, Rus, Nemis, Koreys, Arab, Xitoy va yana 6 til kursi; muddati o‘tgan vazifalar uchun avtomatik SMS eslatma tizimi.
            </p>
          </div>
        </section>

        <footer className="border-t border-slate-200 dark:border-slate-800 pt-5 pb-6 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-400">
          <span>© 2026 348-MAKTAB Raqamli Ta’lim Platformasi</span>
          <span className="inline-flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            Xavfsiz rollar boshqaruvi va Click to‘lov tizimi
          </span>
        </footer>
      </main>
    </div>
  );
}
