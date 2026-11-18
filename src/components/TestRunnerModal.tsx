import { useEffect, useState } from 'react';
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  X,
  XCircle,
} from 'lucide-react';
import { tr } from '../i18n/translations.ts';
import { apiFetch } from '../lib/api.ts';
import type {
  Lang,
  SchoolTest,
  TestAttemptResult,
  TestQuestion,
} from '../types/lms.ts';

interface TestRunnerModalProps {
  test: SchoolTest;
  lang: Lang;
  onClose: () => void;
  onCompleted: (result: TestAttemptResult) => void;
}

const OPTION_LETTERS = ['A', 'B', 'C', 'D'] as const;

export function TestRunnerModal({
  test,
  lang,
  onClose,
  onCompleted,
}: TestRunnerModalProps) {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState<number[]>(
    Array(test.questions.length).fill(-1)
  );
  const [secondsLeft, setSecondsLeft] = useState(test.durationMinutes * 60);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<TestAttemptResult | null>(null);
  const [gradedQuestions, setGradedQuestions] = useState<TestQuestion[] | null>(
    null
  );

  useEffect(() => {
    if (result) return;
    const timer = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          clearInterval(timer);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [result]);

  async function handleFinish() {
    if (submitting || result) return;
    setSubmitting(true);
    setError(null);
    try {
      const data = await apiFetch<{
        result: TestAttemptResult;
        questions: TestQuestion[];
      }>(`/api/student/tests/${test.id}/submit`, {
        method: 'POST',
        body: JSON.stringify({ answers }),
      });
      setResult(data.result);
      setGradedQuestions(data.questions);
      onCompleted(data.result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Testni saqlashda xatolik');
    } finally {
      setSubmitting(false);
    }
  }

  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, '0');
  const ss = String(secondsLeft % 60).padStart(2, '0');
  const answeredCount = answers.filter((a) => a !== -1).length;
  const q = test.questions[currentIdx];

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4">
      <div className="w-full max-w-3xl max-h-[94vh] flex flex-col rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-2xl">
        <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950">
          <div className="min-w-0">
            <h3 className="text-sm sm:text-base font-semibold text-slate-900 dark:text-slate-100 truncate">
              {test.title}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
              {answeredCount} / {test.questions.length} javob belgilandi
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {!result && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-200 dark:bg-slate-800 text-xs font-mono-num font-semibold text-slate-800 dark:text-slate-200">
                <Clock className="w-3.5 h-3.5" />
                {mm}:{ss}
              </span>
            )}
            <button
              type="button"
              onClick={onClose}
              className="min-h-[36px] min-w-[36px] inline-flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          {!result && q ? (
            <div className="space-y-5">
              {/* 1-20 Navigator Grid: 5 cols on mobile, 10 cols on desktop */}
              <div className="grid grid-cols-5 sm:grid-cols-10 gap-1.5">
                {test.questions.map((item, idx) => {
                  const isCurrent = idx === currentIdx;
                  const isAnswered = answers[idx] !== -1;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setCurrentIdx(idx)}
                      className={`min-h-[36px] rounded-lg text-xs font-mono-num font-semibold border transition-colors cursor-pointer ${
                        isCurrent
                          ? 'border-sky-600 bg-sky-600 text-white'
                          : isAnswered
                          ? 'border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                          : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      {idx + 1}
                    </button>
                  );
                })}
              </div>

              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-4 sm:p-5">
                <p className="text-xs font-medium text-sky-700 dark:text-sky-400 mb-2">
                  Savol {currentIdx + 1} / {test.questions.length}
                </p>
                <h4 className="text-base sm:text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4 leading-snug">
                  {q.question}
                </h4>

                <div className="space-y-2.5">
                  {q.options.map((opt, optIdx) => {
                    const selected = answers[currentIdx] === optIdx;
                    return (
                      <button
                        key={optIdx}
                        type="button"
                        onClick={() => {
                          setAnswers((prev) => {
                            const next = [...prev];
                            next[currentIdx] = optIdx;
                            return next;
                          });
                        }}
                        className={`w-full min-h-[46px] px-4 py-3 rounded-xl border text-left flex items-center gap-3 transition-colors cursor-pointer ${
                          selected
                            ? 'border-sky-600 bg-sky-50 dark:bg-sky-950/60 text-slate-900 dark:text-white'
                            : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:border-slate-300 dark:hover:border-slate-700'
                        }`}
                      >
                        <span
                          className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${
                            selected
                              ? 'bg-sky-600 text-white'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                          }`}
                        >
                          {OPTION_LETTERS[optIdx]}
                        </span>
                        <span className="text-sm">{opt}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {error && (
                <p className="text-xs text-rose-600 dark:text-rose-400">{error}</p>
              )}
            </div>
          ) : result && gradedQuestions ? (
            <div className="space-y-5">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-3.5">
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {tr(lang, 'totalScore')}
                  </p>
                  <p className="text-2xl font-bold font-mono-num text-sky-600 dark:text-sky-400 mt-1">
                    {result.percentage}%
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-3.5">
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {tr(lang, 'correctAnswers')}
                  </p>
                  <p className="text-2xl font-bold font-mono-num text-emerald-600 dark:text-emerald-400 mt-1">
                    {result.correctCount}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-3.5">
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {tr(lang, 'wrongAnswers')}
                  </p>
                  <p className="text-2xl font-bold font-mono-num text-rose-600 dark:text-rose-400 mt-1">
                    {result.wrongCount}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-3.5">
                  <p className="text-xs text-slate-500 dark:text-slate-400">Savollar</p>
                  <p className="text-2xl font-bold font-mono-num text-slate-900 dark:text-slate-100 mt-1">
                    {result.totalQuestions}
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  Xatolar va to‘g‘ri javoblar izohi
                </h4>
                {gradedQuestions.map((item, idx) => {
                  const chosen = result.answers[idx];
                  const isOk = chosen === item.correctIndex;
                  return (
                    <div
                      key={item.id}
                      className="rounded-xl border border-slate-200 dark:border-slate-800 p-3.5 bg-white dark:bg-slate-950 space-y-1.5"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-xs sm:text-sm font-medium text-slate-900 dark:text-slate-100">
                          {item.question}
                        </p>
                        {isOk ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                        ) : (
                          <XCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                        )}
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-400">
                        Sizning javobingiz:{' '}
                        <span className={isOk ? 'text-emerald-600 font-semibold' : 'text-rose-600 font-semibold'}>
                          {chosen >= 0 ? `${OPTION_LETTERS[chosen]}) ${item.options[chosen]}` : 'Belgilanmagan'}
                        </span>
                        {' · '}To‘g‘ri javob:{' '}
                        <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                          {OPTION_LETTERS[item.correctIndex]}) {item.options[item.correctIndex]}
                        </span>
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Izoh: {item.explanation}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950">
          {!result ? (
            <>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={currentIdx === 0}
                  onClick={() => setCurrentIdx((i) => Math.max(0, i - 1))}
                  className="min-h-[40px] px-3 py-2 inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 disabled:opacity-40 cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                  {tr(lang, 'previousQuestion')}
                </button>
                <button
                  type="button"
                  disabled={currentIdx >= test.questions.length - 1}
                  onClick={() =>
                    setCurrentIdx((i) => Math.min(test.questions.length - 1, i + 1))
                  }
                  className="min-h-[40px] px-3 py-2 inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 disabled:opacity-40 cursor-pointer"
                >
                  {tr(lang, 'nextQuestion')}
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
              <button
                type="button"
                disabled={submitting}
                onClick={handleFinish}
                className="min-h-[40px] px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold cursor-pointer disabled:opacity-50"
              >
                {submitting ? 'Tekshirilmoqda...' : tr(lang, 'finishTest')}
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={onClose}
              className="ml-auto min-h-[40px] px-5 py-2 rounded-lg bg-slate-900 dark:bg-sky-600 text-white text-xs font-semibold cursor-pointer"
            >
              Kabinetga qaytish
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
