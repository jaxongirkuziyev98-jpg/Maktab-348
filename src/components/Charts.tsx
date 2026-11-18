export interface BarDatum {
  label: string;
  value: number;
  max?: number;
  sublabel?: string;
}

export function SubjectProgressChart({
  title,
  data,
  accentClass = 'bg-sky-600 dark:bg-sky-500',
}: {
  title: string;
  data: BarDatum[];
  accentClass?: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5">
      <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-4">
        {title}
      </h3>
      {data.length === 0 ? (
        <p className="text-xs text-slate-500 dark:text-slate-400 py-4">
          Hali statistik ma’lumotlar shakllanmagan.
        </p>
      ) : (
        <div className="space-y-3">
          {data.map((d) => {
            const pct = Math.max(
              0,
              Math.min(100, Math.round((d.value / (d.max || 100)) * 100))
            );
            return (
              <div key={d.label} className="space-y-1">
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="font-medium text-slate-700 dark:text-slate-300 truncate">
                    {d.label}
                  </span>
                  <span className="font-mono-num font-semibold text-slate-900 dark:text-slate-100 shrink-0">
                    {pct}%{d.sublabel ? ` · ${d.sublabel}` : ''}
                  </span>
                </div>
                <div className="h-2.5 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${accentClass}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function MiniColumnChart({
  title,
  bars,
}: {
  title: string;
  bars: { label: string; value: number; color?: string }[];
}) {
  const maxVal = Math.max(10, ...bars.map((b) => b.value));
  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5">
      <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-4">
        {title}
      </h3>
      <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 sm:gap-3 items-end h-36 pt-4">
        {bars.map((b) => {
          const hPct = Math.max(8, Math.round((b.value / maxVal) * 100));
          return (
            <div key={b.label} className="flex flex-col items-center gap-1.5 h-full justify-end min-w-0">
              <span className="text-[11px] font-mono-num font-semibold text-slate-700 dark:text-slate-300">
                {b.value}
              </span>
              <div className="w-full max-w-[36px] flex-1 flex items-end bg-slate-100 dark:bg-slate-800 rounded-md overflow-hidden">
                <div
                  className={`w-full rounded-t-md transition-all duration-300 ${
                    b.color || 'bg-sky-600 dark:bg-sky-500'
                  }`}
                  style={{ height: `${hPct}%` }}
                />
              </div>
              <span className="text-[11px] text-slate-500 dark:text-slate-400 truncate max-w-full">
                {b.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
