import type { Lang } from '../types/lms.ts';

interface LanguageSwitcherProps {
  lang: Lang;
  onChange: (lang: Lang) => void;
}

const LANGS: { id: Lang; label: string }[] = [
  { id: 'uz', label: 'UZ' },
  { id: 'ru', label: 'RU' },
  { id: 'en', label: 'EN' },
];

export function LanguageSwitcher({ lang, onChange }: LanguageSwitcherProps) {
  return (
    <div className="inline-flex items-center p-1 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shrink-0">
      {LANGS.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => onChange(item.id)}
          className={`min-h-[32px] px-2.5 py-1 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
            lang === item.id
              ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
