import { useEffect, useState } from 'react';
import {
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Download,
  ExternalLink,
  FileText,
  X,
} from 'lucide-react';
import { getStoredToken } from '../lib/api.ts';
import type { Ebook } from '../types/lms.ts';

interface PdfBookReaderProps {
  ebook: Ebook;
  onClose: () => void;
}

export function PdfBookReader({ ebook, onClose }: PdfBookReaderProps) {
  const [mode, setMode] = useState<'chapters' | 'pdf'>('chapters');
  const [chapterIdx, setChapterIdx] = useState(0);
  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [loadingPdf, setLoadingPdf] = useState(false);

  const token = getStoredToken();
  const authedPdfUrl = token
    ? `${ebook.pdfUrl}?token=${encodeURIComponent(token)}`
    : ebook.pdfUrl;

  useEffect(() => {
    let active = true;
    let objectUrl: string | null = null;

    async function loadPdf() {
      setLoadingPdf(true);
      setPdfError(null);
      try {
        const res = await fetch(ebook.pdfUrl, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          credentials: 'include',
        });
        if (!res.ok) throw new Error('PDF faylni yuklab bo‘lmadi');
        const blob = await res.blob();
        objectUrl = URL.createObjectURL(blob);
        if (active) setPdfBlobUrl(objectUrl);
      } catch (err) {
        if (active) {
          setPdfError(err instanceof Error ? err.message : 'PDF xatoligi');
        }
      } finally {
        if (active) setLoadingPdf(false);
      }
    }

    loadPdf();
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [ebook.pdfUrl, token]);

  const currentChapter = ebook.chapters[chapterIdx];

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-2 sm:p-5">
      <div className="w-full max-w-4xl max-h-[92vh] flex flex-col rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-2xl">
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950">
          <div className="min-w-0 flex-1">
            <h3 className="text-sm sm:text-base font-semibold text-slate-900 dark:text-slate-100 truncate">
              {ebook.title}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
              {ebook.author} · {ebook.pagesCount} sahifa
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <div className="inline-flex p-0.5 rounded-lg bg-slate-200 dark:bg-slate-800">
              <button
                type="button"
                onClick={() => setMode('chapters')}
                className={`px-2.5 py-1.5 text-xs font-medium rounded-md cursor-pointer whitespace-nowrap ${
                  mode === 'chapters'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white'
                    : 'text-slate-600 dark:text-slate-300'
                }`}
              >
                <BookOpen className="w-3.5 h-3.5 inline mr-1" />
                Kitob
              </button>
              <button
                type="button"
                onClick={() => setMode('pdf')}
                className={`px-2.5 py-1.5 text-xs font-medium rounded-md cursor-pointer whitespace-nowrap ${
                  mode === 'pdf'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white'
                    : 'text-slate-600 dark:text-slate-300'
                }`}
              >
                <FileText className="w-3.5 h-3.5 inline mr-1" />
                PDF
              </button>
            </div>
            <a
              href={pdfBlobUrl || authedPdfUrl}
              download={`${ebook.id}.pdf`}
              className="min-h-[36px] px-3 py-1.5 inline-flex items-center gap-1.5 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-xs font-medium whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Yuklab olish</span>
            </a>
            <button
              type="button"
              onClick={onClose}
              className="min-h-[36px] min-w-[36px] inline-flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              aria-label="Yopish"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          {mode === 'chapters' ? (
            <div className="max-w-2xl mx-auto space-y-5">
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-4 sm:p-5">
                <p className="text-xs font-medium text-sky-700 dark:text-sky-400 mb-1">
                  {ebook.grade}-sinf elektron darslik · {chapterIdx + 1}-bob / {ebook.chapters.length}
                </p>
                <h4 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-slate-100 mb-3">
                  {currentChapter?.title || ebook.title}
                </h4>
                <div className="text-sm sm:text-base text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-line">
                  {currentChapter?.content || ebook.summary}
                </div>
              </div>

              <div className="flex items-center justify-between gap-3 pt-2">
                <button
                  type="button"
                  disabled={chapterIdx === 0}
                  onClick={() => setChapterIdx((i) => Math.max(0, i - 1))}
                  className="min-h-[42px] px-4 py-2 inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 disabled:opacity-40 cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                  Oldingi bob
                </button>
                <span className="text-xs font-mono-num text-slate-500 dark:text-slate-400">
                  {chapterIdx + 1} / {Math.max(1, ebook.chapters.length)}
                </span>
                <button
                  type="button"
                  disabled={chapterIdx >= ebook.chapters.length - 1}
                  onClick={() =>
                    setChapterIdx((i) => Math.min(ebook.chapters.length - 1, i + 1))
                  }
                  className="min-h-[42px] px-4 py-2 inline-flex items-center gap-1.5 rounded-lg bg-slate-900 dark:bg-sky-600 text-white text-xs font-medium disabled:opacity-40 cursor-pointer"
                >
                  Keyingi bob
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {loadingPdf ? (
                <div className="py-16 text-center text-sm text-slate-500 dark:text-slate-400">
                  PDF hujjat tayyorlanmoqda...
                </div>
              ) : pdfError || !pdfBlobUrl ? (
                <div className="py-12 text-center space-y-3">
                  <p className="text-sm text-rose-600 dark:text-rose-400">
                    {pdfError || 'Brauzerda PDF ko‘rsatib bo‘lmadi.'}
                  </p>
                  <a
                    href={authedPdfUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-sky-600 text-white text-xs font-medium"
                  >
                    <ExternalLink className="w-4 h-4" />
                    Alohida oynada ochish
                  </a>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                    <span>Haqiqiy PDF hujjat (application/pdf)</span>
                    <a
                      href={pdfBlobUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-sky-600 dark:text-sky-400 font-medium hover:underline"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      Katta oynada ochish
                    </a>
                  </div>
                  <iframe
                    src={pdfBlobUrl}
                    title={ebook.title}
                    className="w-full h-[65vh] rounded-lg border border-slate-200 dark:border-slate-800 bg-white"
                  />
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
