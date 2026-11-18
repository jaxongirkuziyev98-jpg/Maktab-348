import { useEffect, useRef, useState } from 'react';
import {
  BookOpen,
  CheckCircle2,
  ClipboardCheck,
  Headphones,
  Layers,
  Mic,
  Play,
  Square,
  Volume2,
} from 'lucide-react';
import { tr } from '../i18n/translations.ts';
import { apiFetch } from '../lib/api.ts';
import type {
  Lang,
  LanguageCourse,
  LanguageLevel,
  LanguageProgress,
  SchoolTest,
  TestAttemptResult,
} from '../types/lms.ts';
import { TestRunnerModal } from './TestRunnerModal.tsx';
import { VideoLessonViewer } from './VideoLessonViewer.tsx';

interface LanguageCenterProps {
  lang: Lang;
}

const LEVELS: LanguageLevel[] = ['Beginner', 'Intermediate', 'Advanced'];

type CourseTab =
  | 'video'
  | 'grammar'
  | 'vocab'
  | 'listening'
  | 'speaking'
  | 'reading'
  | 'homework'
  | 'test';

export function LanguageCenter({ lang }: LanguageCenterProps) {
  const [courses, setCourses] = useState<LanguageCourse[]>([]);
  const [tests, setTests] = useState<SchoolTest[]>([]);
  const [progressList, setProgressList] = useState<LanguageProgress[]>([]);
  const [results, setResults] = useState<TestAttemptResult[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<string>('english');
  const [selectedLevel, setSelectedLevel] = useState<LanguageLevel>('Beginner');
  const [activeTab, setActiveTab] = useState<CourseTab>('video');
  const [flashIndex, setFlashIndex] = useState(0);
  const [flashFlipped, setFlashFlipped] = useState(false);
  const [listeningChoice, setListeningChoice] = useState<number | null>(null);
  const [readingChoice, setReadingChoice] = useState<number | null>(null);
  const [homeworkText, setHomeworkText] = useState('');
  const [hwSuccess, setHwSuccess] = useState(false);
  const [runningTest, setRunningTest] = useState<SchoolTest | null>(null);
  const [recording, setRecording] = useState(false);
  const [recordedAudioUrl, setRecordedAudioUrl] = useState<string | null>(null);
  const [micError, setMicError] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    apiFetch<{
      courses: LanguageCourse[];
      tests: SchoolTest[];
      progress: LanguageProgress[];
      testResults: TestAttemptResult[];
    }>('/api/languages')
      .then((res) => {
        setCourses(res.courses);
        setTests(res.tests);
        setProgressList(res.progress);
        setResults(res.testResults);
      })
      .catch(() => {});
  }, []);

  const course = courses.find((c) => c.id === selectedCourseId) || courses[0];
  const levelContent = course?.levels[selectedLevel];
  const currentProgress = progressList.find(
    (p) => p.courseId === course?.id && p.level === selectedLevel
  );
  const matchingTest = tests.find(
    (t) => t.languageCourseId === course?.id && t.languageLevel === selectedLevel
  );
  const latestResult = results.find(
    (r) => r.testId === matchingTest?.id
  );

  function speakText(text: string, speechLang: string) {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = speechLang;
    utter.rate = 0.92;
    window.speechSynthesis.speak(utter);
  }

  async function markProgress(payload: {
    section?: string;
    learnedWord?: string;
    homeworkText?: string;
  }) {
    if (!course) return;
    try {
      const res = await apiFetch<{ progress: LanguageProgress }>(
        `/api/languages/${course.id}/progress`,
        {
          method: 'POST',
          body: JSON.stringify({ level: selectedLevel, ...payload }),
        }
      );
      setProgressList((prev) => {
        const idx = prev.findIndex(
          (p) => p.courseId === course.id && p.level === selectedLevel
        );
        if (idx >= 0) {
          const copy = [...prev];
          copy[idx] = res.progress;
          return copy;
        }
        return [...prev, res.progress];
      });
    } catch {
      // ignore
    }
  }

  async function toggleMicRecording() {
    setMicError(null);
    if (recording && mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      setRecording(false);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      chunksRef.current = [];
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      rec.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        const url = URL.createObjectURL(blob);
        setRecordedAudioUrl(url);
        stream.getTracks().forEach((t) => t.stop());
        markProgress({ section: 'speaking' });
      };
      mediaRecorderRef.current = rec;
      rec.start();
      setRecording(true);
    } catch {
      setMicError('Mikrofonga ruxsat berilmadi yoki qurilma topilmadi.');
    }
  }

  function courseLabel(c: LanguageCourse): string {
    if (lang === 'ru') return c.nameRu;
    if (lang === 'en') return c.nameEn;
    return c.nameUz;
  }

  if (!course || !levelContent) {
    return (
      <div className="p-6 text-sm text-slate-500 dark:text-slate-400">
        Til kurslari yuklanmoqda...
      </div>
    );
  }

  const tabs: { id: CourseTab; label: string }[] = [
    { id: 'video', label: 'Video dars' },
    { id: 'grammar', label: 'Grammatika' },
    { id: 'vocab', label: 'Lug‘at & Yodlash' },
    { id: 'listening', label: 'Listening' },
    { id: 'speaking', label: 'Speaking' },
    { id: 'reading', label: 'Reading' },
    { id: 'homework', label: 'Uy vazifasi' },
    { id: 'test', label: '20 savollik test' },
  ];

  const completedCount = currentProgress?.completedSections.length || 0;
  const progressPct = Math.min(100, Math.round((completedCount / 6) * 100));

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white">
            12 ta til kursi markazi
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            Beginner, Intermediate va Advanced bosqichlari · Video, lug‘at, audio va 20 savollik testlar
          </p>
        </div>
        <div className="text-xs font-mono-num text-slate-600 dark:text-slate-300">
          Progress: <span className="font-bold text-sky-600 dark:text-sky-400">{progressPct}%</span>
          {latestResult ? ` · Oxirgi test: ${latestResult.percentage}%` : ''}
        </div>
      </div>

      {/* 12 Languages Selector */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
        {courses.map((c) => {
          const active = c.id === course.id;
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => {
                setSelectedCourseId(c.id);
                setFlashIndex(0);
                setFlashFlipped(false);
                setListeningChoice(null);
                setReadingChoice(null);
                setHwSuccess(false);
              }}
              className={`min-h-[48px] px-3 py-2 rounded-xl border text-left transition-colors cursor-pointer ${
                active
                  ? 'border-sky-600 bg-sky-50 dark:bg-sky-950/60 text-sky-900 dark:text-white'
                  : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-700'
              }`}
            >
              <p className="text-xs font-bold truncate">{courseLabel(c)}</p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                {c.nativeName} · {c.code}
              </p>
            </button>
          );
        })}
      </div>

      {/* Level Switcher + Course Section Tabs */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-3">
          <div>
            <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
              {courseLabel(course)} ({course.nativeName}) — {selectedLevel}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Yodlangan so‘zlar: {currentProgress?.learnedWords.length || 0} / {levelContent.vocabulary.length}
            </p>
          </div>
          <div className="inline-flex p-1 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 self-start">
            {LEVELS.map((lvl) => (
              <button
                key={lvl}
                type="button"
                onClick={() => setSelectedLevel(lvl)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
                  selectedLevel === lvl
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                {lvl}
              </button>
            ))}
          </div>
        </div>

        {/* Scrollable horizontal tabs on mobile */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setActiveTab(t.id)}
              className={`min-h-[38px] px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer border transition-colors ${
                activeTab === t.id
                  ? 'border-sky-600 bg-sky-600 text-white'
                  : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-700 dark:text-slate-300'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab Body */}
        {activeTab === 'video' && (
          <div className="space-y-3">
            <VideoLessonViewer
              lesson={{
                id: `lang-vid-${course.id}-${selectedLevel}`,
                title: levelContent.videoTitle,
                subjectId: course.id,
                grade: 0,
                topic: `${courseLabel(course)} · ${selectedLevel}`,
                durationMinutes: 14,
                videoUrl: levelContent.videoUrl,
                notes: `${courseLabel(course)} (${selectedLevel}) bosqichi uchun asosiy video mashg‘ulot. Videoni tomosha qilgach lug‘at va test bo‘limiga o‘ting.`,
                createdAt: '',
              }}
            />
            <button
              type="button"
              onClick={() => markProgress({ section: 'video' })}
              className="min-h-[40px] px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-semibold cursor-pointer inline-flex items-center gap-1.5"
            >
              <CheckCircle2 className="w-4 h-4" />
              Video ko‘rildi deb belgilash
            </button>
          </div>
        )}

        {activeTab === 'grammar' && (
          <div className="space-y-3">
            <h4 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-sky-600" />
              {levelContent.grammarTitle}
            </h4>
            <ul className="space-y-2">
              {levelContent.grammarRules.map((rule, idx) => (
                <li
                  key={idx}
                  className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-sm text-slate-700 dark:text-slate-300"
                >
                  {idx + 1}. {rule}
                </li>
              ))}
            </ul>
            <button
              type="button"
              onClick={() => markProgress({ section: 'grammar' })}
              className="min-h-[40px] px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-semibold cursor-pointer inline-flex items-center gap-1.5"
            >
              <CheckCircle2 className="w-4 h-4" />
              Grammatika o‘zlashtirildi
            </button>
          </div>
        )}

        {activeTab === 'vocab' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="space-y-2.5">
              <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                Lug‘at (Audio talaffuz bilan)
              </h4>
              {levelContent.vocabulary.map((v) => {
                const learned = currentProgress?.learnedWords.includes(v.word);
                return (
                  <div
                    key={v.word}
                    className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex items-center justify-between gap-2"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-slate-900 dark:text-white">
                        {v.word}{' '}
                        <span className="text-xs font-normal text-slate-500">
                          {v.phonetic}
                        </span>
                      </p>
                      <p className="text-xs text-slate-600 dark:text-slate-300">
                        {lang === 'ru'
                          ? v.translationRu
                          : lang === 'en'
                          ? v.translationEn
                          : v.translationUz}{' '}
                        · <span className="italic">{v.example}</span>
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => speakText(v.word, course.speechLang)}
                        className="min-h-[36px] min-w-[36px] inline-flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sky-600 cursor-pointer"
                        title="Tinglash"
                      >
                        <Volume2 className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => markProgress({ learnedWord: v.word })}
                        className={`min-h-[36px] px-2.5 rounded-lg text-xs font-semibold cursor-pointer ${
                          learned
                            ? 'bg-emerald-600 text-white'
                            : 'border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200'
                        }`}
                      >
                        {learned ? 'Yodlandi ✓' : 'Yodlash'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Interactive Flashcard */}
            {levelContent.vocabulary[flashIndex] && (
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-5 flex flex-col justify-between space-y-4">
                <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                  <span className="inline-flex items-center gap-1.5 font-semibold">
                    <Layers className="w-4 h-4 text-sky-600" />
                    So‘z yodlash kartochkasi
                  </span>
                  <span className="font-mono-num">
                    {flashIndex + 1} / {levelContent.vocabulary.length}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => setFlashFlipped((f) => !f)}
                  className="min-h-[160px] rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 text-center flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-sky-400 transition-colors"
                >
                  {!flashFlipped ? (
                    <>
                      <p className="text-2xl font-bold text-slate-900 dark:text-white">
                        {levelContent.vocabulary[flashIndex].word}
                      </p>
                      <p className="text-xs text-slate-500">
                        {levelContent.vocabulary[flashIndex].phonetic} · Tarjimasini ko‘rish uchun bosing
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400">
                        {lang === 'ru'
                          ? levelContent.vocabulary[flashIndex].translationRu
                          : lang === 'en'
                          ? levelContent.vocabulary[flashIndex].translationEn
                          : levelContent.vocabulary[flashIndex].translationUz}
                      </p>
                      <p className="text-xs text-slate-600 dark:text-slate-300">
                        {levelContent.vocabulary[flashIndex].example}
                      </p>
                    </>
                  )}
                </button>

                <div className="flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setFlashFlipped(false);
                      setFlashIndex((i) =>
                        i === 0 ? levelContent.vocabulary.length - 1 : i - 1
                      );
                    }}
                    className="min-h-[40px] px-4 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold cursor-pointer"
                  >
                    Oldingi
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      speakText(
                        levelContent.vocabulary[flashIndex].word,
                        course.speechLang
                      )
                    }
                    className="min-h-[40px] px-4 rounded-lg bg-sky-600 text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Volume2 className="w-4 h-4" />
                    Talaffuz
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setFlashFlipped(false);
                      setFlashIndex((i) => (i + 1) % levelContent.vocabulary.length);
                    }}
                    className="min-h-[40px] px-4 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold cursor-pointer"
                  >
                    Keyingi
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'listening' && (
          <div className="space-y-4">
            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <Headphones className="w-5 h-5 text-sky-600" />
                <div>
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">
                    Audio matnni tinglang va savolga javob bering
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {course.speechLang} ovozli sintezatori orqali ijro etiladi
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  speakText(levelContent.listeningScript, course.speechLang);
                  markProgress({ section: 'listening' });
                }}
                className="min-h-[40px] px-4 py-2 rounded-xl bg-sky-600 text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Play className="w-4 h-4" />
                Audioni tinglash
              </button>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-semibold text-slate-900 dark:text-white">
                {levelContent.listeningQuestion}
              </p>
              {levelContent.listeningOptions.map((opt, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setListeningChoice(idx)}
                  className={`w-full min-h-[42px] px-3.5 py-2 rounded-xl border text-left text-xs sm:text-sm cursor-pointer ${
                    listeningChoice === idx
                      ? idx === levelContent.listeningCorrectIndex
                        ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-200'
                        : 'border-rose-500 bg-rose-50 dark:bg-rose-950/50 text-rose-800 dark:text-rose-200'
                      : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'speaking' && (
          <div className="space-y-4">
            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 space-y-2">
              <p className="text-sm font-semibold text-slate-900 dark:text-white">
                {levelContent.speakingPrompt}
              </p>
              <button
                type="button"
                onClick={() => speakText(levelContent.speakingSample, course.speechLang)}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-sky-600 dark:text-sky-400 cursor-pointer"
              >
                <Volume2 className="w-4 h-4" />
                Namunani tinglash
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={toggleMicRecording}
                className={`min-h-[44px] px-5 py-2 rounded-xl text-xs font-semibold inline-flex items-center gap-2 cursor-pointer ${
                  recording
                    ? 'bg-rose-600 text-white'
                    : 'bg-sky-600 text-white hover:bg-sky-700'
                }`}
              >
                {recording ? (
                  <>
                    <Square className="w-4 h-4" />
                    Yozishni to‘xtatish
                  </>
                ) : (
                  <>
                    <Mic className="w-4 h-4" />
                    Mikrofonga gapirish
                  </>
                )}
              </button>
              {recordedAudioUrl && (
                <audio src={recordedAudioUrl} controls className="h-10" />
              )}
            </div>
            {micError && (
              <p className="text-xs text-rose-600 dark:text-rose-400">{micError}</p>
            )}
          </div>
        )}

        {activeTab === 'reading' && (
          <div className="space-y-4">
            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 space-y-2">
              <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                {levelContent.readingTitle}
              </h4>
              <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                {levelContent.readingPassage}
              </p>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-semibold text-slate-900 dark:text-white">
                {levelContent.readingQuestion}
              </p>
              {levelContent.readingOptions.map((opt, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    setReadingChoice(idx);
                    markProgress({ section: 'reading' });
                  }}
                  className={`w-full min-h-[42px] px-3.5 py-2 rounded-xl border text-left text-xs sm:text-sm cursor-pointer ${
                    readingChoice === idx
                      ? idx === levelContent.readingCorrectIndex
                        ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-200'
                        : 'border-rose-500 bg-rose-50 dark:bg-rose-950/50 text-rose-800 dark:text-rose-200'
                      : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'homework' && (
          <div className="space-y-3">
            <p className="text-sm font-semibold text-slate-900 dark:text-white">
              {levelContent.homeworkPrompt}
            </p>
            <textarea
              rows={4}
              value={homeworkText || currentProgress?.homeworkText || ''}
              onChange={(e) => setHomeworkText(e.target.value)}
              placeholder="Javobingizni shu yerga yozing..."
              className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-sm text-slate-900 dark:text-white"
            />
            <button
              type="button"
              onClick={async () => {
                await markProgress({
                  section: 'homework',
                  homeworkText: homeworkText || currentProgress?.homeworkText || '',
                });
                setHwSuccess(true);
              }}
              className="min-h-[42px] px-5 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold cursor-pointer"
            >
              Vazifani saqlash
            </button>
            {hwSuccess && (
              <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                Til kursi uy vazifangiz saqlandi ✓
              </p>
            )}
          </div>
        )}

        {activeTab === 'test' && matchingTest && (
          <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h4 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                {matchingTest.title}
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                20 ta savol · {matchingTest.durationMinutes} daqiqa
                {latestResult ? ` · Oxirgi natija: ${latestResult.percentage}%` : ''}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setRunningTest(matchingTest)}
              className="min-h-[44px] px-5 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold inline-flex items-center justify-center gap-2 cursor-pointer"
            >
              <ClipboardCheck className="w-4 h-4" />
              {tr(lang, 'startTest')}
            </button>
          </div>
        )}
      </div>

      {runningTest && (
        <TestRunnerModal
          test={runningTest}
          lang={lang}
          onClose={() => setRunningTest(null)}
          onCompleted={(r) => {
            setResults((prev) => [r, ...prev]);
            markProgress({ section: 'test' });
          }}
        />
      )}
    </div>
  );
}
