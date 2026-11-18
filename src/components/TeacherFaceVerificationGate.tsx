import { useCallback, useState } from 'react';
import { LogOut, ShieldCheck } from 'lucide-react';
import { tr } from '../i18n/translations.ts';
import { apiFetch } from '../lib/api.ts';
import type { Lang, ThemeMode, UserProfile } from '../types/lms.ts';
import { FaceVerificationCircle } from './FaceVerificationCircle.tsx';
import { LanguageSwitcher } from './LanguageSwitcher.tsx';
import { ThemeToggleButton } from './ThemeToggleButton.tsx';

interface TeacherFaceVerificationGateProps {
  user: UserProfile;
  lang: Lang;
  onLangChange: (lang: Lang) => void;
  theme: ThemeMode;
  onToggleTheme: () => void;
  onVerified: (user: UserProfile) => void;
  onLogout: () => void;
}

export function TeacherFaceVerificationGate({
  user,
  lang,
  onLangChange,
  theme,
  onToggleTheme,
  onVerified,
  onLogout,
}: TeacherFaceVerificationGateProps) {
  const [error, setError] = useState<string | null>(null);

  const handleCaptured = useCallback(
    async (imageBase64: string): Promise<boolean> => {
      setError(null);
      try {
        const data = await apiFetch<{ ok: boolean; user: UserProfile }>(
          '/api/auth/teacher-face',
          {
            method: 'POST',
            body: JSON.stringify({ imageBase64 }),
          }
        );
        onVerified(data.user);
        return true;
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Yuz rasmini saqlashda xatolik'
        );
        return false;
      }
    },
    [onVerified]
  );

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col">
      <header className="border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 sm:px-6 py-3">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-3">
          <span className="text-lg font-extrabold tracking-tight text-slate-900 dark:text-white whitespace-nowrap shrink-0">
            {tr(lang, 'brand')}
          </span>
          <div className="flex items-center gap-2 shrink-0">
            <LanguageSwitcher lang={lang} onChange={onLangChange} />
            <ThemeToggleButton theme={theme} onToggle={onToggleTheme} lang={lang} />
            <button
              type="button"
              onClick={onLogout}
              className="min-h-[40px] px-3 py-1.5 inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{tr(lang, 'logout')}</span>
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center p-4 sm:p-6">
        <div className="w-full max-w-md rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm space-y-5">
          <div className="text-center space-y-1.5">
            <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
              <ShieldCheck className="w-4 h-4" />
              <span>{tr(lang, 'teacherFreeBadge')}</span>
            </div>
            <h1 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white">
              {tr(lang, 'faceVerifyTitle')}
            </h1>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              {user.firstName} {user.lastName} — {tr(lang, 'faceVerifyDesc')}
            </p>
          </div>

          <FaceVerificationCircle
            onCaptured={handleCaptured}
            hasError={Boolean(error)}
          />

          {error && (
            <div className="rounded-xl border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/40 p-3 text-xs text-rose-700 dark:text-rose-300 text-center">
              {error}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
