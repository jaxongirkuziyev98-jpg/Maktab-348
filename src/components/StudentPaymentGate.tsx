import { Lock, LogOut } from 'lucide-react';
import { tr } from '../i18n/translations.ts';
import type { Lang, ThemeMode, UserProfile } from '../types/lms.ts';
import { CardTransferCheckout } from './CardTransferCheckout.tsx';
import { LanguageSwitcher } from './LanguageSwitcher.tsx';
import { ThemeToggleButton } from './ThemeToggleButton.tsx';

interface StudentPaymentGateProps {
  user: UserProfile;
  lang: Lang;
  onLangChange: (lang: Lang) => void;
  theme: ThemeMode;
  onToggleTheme: () => void;
  onActivated: (user: UserProfile) => void;
  onLogout: () => void;
}

export function StudentPaymentGate({
  user,
  lang,
  onLangChange,
  theme,
  onToggleTheme,
  onActivated,
  onLogout,
}: StudentPaymentGateProps) {
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
              className="min-h-[40px] px-3 py-1.5 inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer whitespace-nowrap"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{tr(lang, 'logout')}</span>
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center p-4 sm:p-6">
        <div className="w-full max-w-xl rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 sm:p-7 shadow-sm space-y-5">
          <div className="flex items-start gap-3">
            <div className="w-11 h-11 rounded-xl bg-sky-100 dark:bg-sky-950 text-sky-700 dark:text-sky-300 flex items-center justify-center shrink-0">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white">
                {user.firstName} {user.lastName} ({user.grade}-{tr(lang, 'gradeLabel')})
              </h1>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-1">
                O‘quvchi kabinetiga kirish uchun 30 kunlik obunani (10 000 so‘m) faollashtiring. To‘lov tasdiqlangach barcha darslar va testlar darhol ochiladi.
              </p>
            </div>
          </div>

          <CardTransferCheckout lang={lang} onActivated={onActivated} />
        </div>
      </main>
    </div>
  );
}
