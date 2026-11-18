import { Moon, Sun } from 'lucide-react';
import { tr } from '../i18n/translations.ts';
import type { Lang, ThemeMode } from '../types/lms.ts';

interface ThemeToggleButtonProps {
  theme: ThemeMode;
  onToggle: () => void;
  lang: Lang;
}

export function ThemeToggleButton({ theme, onToggle, lang }: ThemeToggleButtonProps) {
  const isDark = theme === 'dark';
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={isDark ? tr(lang, 'dayMode') : tr(lang, 'nightMode')}
      className="inline-flex items-center gap-1.5 min-h-[40px] px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer"
    >
      {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-600" />}
      <span className="hidden sm:inline">{isDark ? tr(lang, 'dayMode') : tr(lang, 'nightMode')}</span>
    </button>
  );
}
