import { BookOpen, Clock, Play, X } from 'lucide-react';
import type { VideoLesson } from '../types/lms.ts';

export function extractYoutubeId(url: string): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    if (u.hostname.includes('youtu.be')) {
      return u.pathname.replace('/', '').split('/')[0] || null;
    }
    if (u.hostname.includes('youtube.com')) {
      if (u.pathname.startsWith('/embed/')) {
        return u.pathname.split('/embed/')[1]?.split('/')[0] || null;
      }
      if (u.pathname.startsWith('/shorts/')) {
        return u.pathname.split('/shorts/')[1]?.split('/')[0] || null;
      }
      return u.searchParams.get('v');
    }
  } catch {
    return null;
  }
  return null;
}

export function getYoutubeThumbnailUrl(url: string): string | null {
  const id = extractYoutubeId(url);
  return id ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : null;
}

interface VideoLessonViewerProps {
  lesson: VideoLesson;
  onClose?: () => void;
}

export function VideoLessonViewer({ lesson, onClose }: VideoLessonViewerProps) {
  const ytId = extractYoutubeId(lesson.videoUrl);
  const isLocalVideo =
    lesson.videoUrl.startsWith('/api/uploads/') ||
    lesson.videoUrl.endsWith('.mp4') ||
    lesson.videoUrl.endsWith('.webm');

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-slate-200 dark:border-slate-800">
        <div className="min-w-0">
          <h3 className="text-sm sm:text-base font-semibold text-slate-900 dark:text-slate-100 truncate">
            {lesson.title}
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2 mt-0.5">
            <span>{lesson.topic}</span>
            <span aria-hidden="true">·</span>
            <span className="inline-flex items-center gap-1 tabular-nums">
              <Clock className="w-3.5 h-3.5" />
              {lesson.durationMinutes} daq
            </span>
          </p>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="min-h-[36px] min-w-[36px] inline-flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer shrink-0"
            aria-label="Yopish"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      <div className="relative w-full aspect-video bg-slate-950">
        {ytId ? (
          <iframe
            className="w-full h-full border-0"
            src={`https://www.youtube.com/embed/${ytId}?rel=0&modestbranding=1`}
            title={lesson.title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        ) : isLocalVideo ? (
          <video
            className="w-full h-full object-contain"
            src={lesson.videoUrl}
            controls
            playsInline
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center text-slate-300 p-6 text-center">
            <Play className="w-10 h-10 mb-2 text-sky-400" />
            <p className="text-sm font-medium">{lesson.title}</p>
            <a
              href={lesson.videoUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-3 px-4 py-2 rounded-lg bg-sky-600 text-white text-xs font-medium hover:bg-sky-700"
            >
              Video havolani ochish
            </a>
          </div>
        )}
      </div>

      <div className="p-4 sm:p-5 bg-slate-50 dark:bg-slate-950/60 border-t border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
          <BookOpen className="w-4 h-4 text-sky-600 dark:text-sky-400" />
          <span>Dars konspekti va asosiy qoidalar</span>
        </div>
        <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
          {lesson.notes}
        </p>
      </div>
    </div>
  );
}
