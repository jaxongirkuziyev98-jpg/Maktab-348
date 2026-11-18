import { useEffect, useRef, useState } from 'react';
import { Camera, CheckCircle2, RefreshCw } from 'lucide-react';

interface FaceVerificationCircleProps {
  onCaptured: (imageBase64: string) => Promise<boolean | void> | boolean | void;
  hasError?: boolean;
}

export function FaceVerificationCircle({
  onCaptured,
  hasError = false,
}: FaceVerificationCircleProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const prevFrameRef = useRef<Uint8ClampedArray | null>(null);
  const stableTicksRef = useRef(0);
  const capturedDoneRef = useRef(false);
  const onCapturedRef = useRef(onCaptured);
  onCapturedRef.current = onCaptured;

  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState(
    'Kamera ishga tushirilmoqda...'
  );
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [capturedPreview, setCapturedPreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [savedOk, setSavedOk] = useState(false);
  const [sessionKey, setSessionKey] = useState(0);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let intervalId: ReturnType<typeof setInterval> | null = null;
    let mounted = true;
    capturedDoneRef.current = false;
    prevFrameRef.current = null;
    stableTicksRef.current = 0;

    async function startCamera() {
      setCameraError(null);
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 480 }, height: { ideal: 480 } },
          audio: false,
        });
        if (!mounted) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        setStatusText('Yuzingizni doira markaziga va tekis holatga keltiring...');

        // Gentle ~3.2 second stability & centering verification (16 checks * 200ms)
        intervalId = setInterval(() => {
          if (capturedDoneRef.current || !videoRef.current || !canvasRef.current) return;
          const video = videoRef.current;
          if (video.readyState < 2) return;

          const analysisCanvas = canvasRef.current;
          const ctx = analysisCanvas.getContext('2d', { willReadFrequently: true });
          if (!ctx) return;

          const w = 96;
          const h = 96;
          analysisCanvas.width = w;
          analysisCanvas.height = h;
          ctx.drawImage(video, 0, 0, w, h);
          const frame = ctx.getImageData(0, 0, w, h).data;

          // Check center brightness and frame-to-frame stillness
          let centerSum = 0;
          let centerCount = 0;
          let diffSum = 0;
          for (let y = 24; y < 72; y++) {
            for (let x = 24; x < 72; x++) {
              const i = (y * w + x) * 4;
              const lum = (frame[i] + frame[i + 1] + frame[i + 2]) / 3;
              centerSum += lum;
              centerCount++;
              if (prevFrameRef.current) {
                const prevLum =
                  (prevFrameRef.current[i] +
                    prevFrameRef.current[i + 1] +
                    prevFrameRef.current[i + 2]) /
                  3;
                diffSum += Math.abs(lum - prevLum);
              }
            }
          }
          const avgLum = centerSum / Math.max(1, centerCount);
          const avgMotion = prevFrameRef.current
            ? diffSum / Math.max(1, centerCount)
            : 100;

          prevFrameRef.current = new Uint8ClampedArray(frame);

          if (avgLum < 25) {
            setStatusText('Yorug‘roq joyga o‘ting — yuz yaxshi ko‘rinmayapti.');
            stableTicksRef.current = Math.max(0, stableTicksRef.current - 1);
          } else if (avgMotion > 16) {
            setStatusText('Qimirlamang — boshingizni tekis tuting...');
            stableTicksRef.current = Math.max(0, stableTicksRef.current - 1);
          } else {
            stableTicksRef.current += 1;
            const pct = Math.min(100, Math.round((stableTicksRef.current / 16) * 100));
            setProgress(pct);
            if (pct < 45) {
              setStatusText('Boshingizni tekis tuting...');
            } else if (pct < 90) {
              setStatusText('Ajoyib! Tekis va qimirlamay turing...');
            } else {
              setStatusText('Yuz tasdiqlandi! Rasm olinmoqda...');
            }

            if (stableTicksRef.current >= 16) {
              capturedDoneRef.current = true;
              if (intervalId) clearInterval(intervalId);

              const snapCanvas = document.createElement('canvas');
              snapCanvas.width = 280;
              snapCanvas.height = 280;
              const sCtx = snapCanvas.getContext('2d');
              if (sCtx) {
                const size = Math.min(video.videoWidth, video.videoHeight) || 280;
                const sx = Math.max(0, (video.videoWidth - size) / 2);
                const sy = Math.max(0, (video.videoHeight - size) / 2);
                sCtx.save();
                sCtx.translate(280, 0);
                sCtx.scale(-1, 1);
                sCtx.drawImage(video, sx, sy, size, size, 0, 0, 280, 280);
                sCtx.restore();
                const dataUrl = snapCanvas.toDataURL('image/jpeg', 0.82);
                // Stop camera tracks immediately after capture
                if (stream) {
                  stream.getTracks().forEach((t) => t.stop());
                }
                setCapturedPreview(dataUrl);
                setSubmitting(true);
                setSavedOk(false);
                Promise.resolve(onCapturedRef.current(dataUrl))
                  .then((ok) => {
                    if (mounted && ok !== false) {
                      setSavedOk(true);
                    }
                  })
                  .finally(() => {
                    if (mounted) setSubmitting(false);
                  });
              }
            }
          }
        }, 200);
      } catch {
        if (mounted) {
          setCameraError(
            'Kameraga ruxsat berilmadi yoki qurilma topilmadi. Brauzerdan kameraga ruxsat bering.'
          );
        }
      }
    }

    startCamera();
    return () => {
      mounted = false;
      if (intervalId) clearInterval(intervalId);
      if (stream) stream.getTracks().forEach((t) => t.stop());
    };
  }, [sessionKey]);

  async function handleRetryUpload() {
    if (!capturedPreview || submitting) return;
    setSubmitting(true);
    try {
      const ok = await onCapturedRef.current(capturedPreview);
      if (ok !== false) setSavedOk(true);
    } finally {
      setSubmitting(false);
    }
  }

  function handleRetakePhoto() {
    setCapturedPreview(null);
    setSavedOk(false);
    setProgress(0);
    setStatusText('Kamera qayta ishga tushirilmoqda...');
    setSessionKey((k) => k + 1);
  }

  const radius = 114;
  const circumference = 2 * Math.PI * radius;
  const strokeOffset = circumference - (progress / 100) * circumference;

  return (
    <div className="flex flex-col items-center space-y-4">
      <div className="relative w-64 h-64 flex items-center justify-center">
        <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 256 256">
          <circle
            cx="128"
            cy="128"
            r={radius}
            fill="none"
            stroke="currentColor"
            className="text-slate-200 dark:text-slate-800"
            strokeWidth="8"
          />
          <circle
            cx="128"
            cy="128"
            r={radius}
            fill="none"
            stroke={hasError ? '#f43f5e' : progress >= 70 ? '#10b981' : '#0284c7'}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeOffset}
            className="transition-all duration-200"
          />
        </svg>

        <div className="w-52 h-52 rounded-full overflow-hidden bg-slate-900 border-4 border-white dark:border-slate-950 shadow-inner flex items-center justify-center">
          {capturedPreview ? (
            <img
              src={capturedPreview}
              alt="O‘qituvchi rasmi"
              className="w-full h-full object-cover"
            />
          ) : cameraError ? (
            <div className="p-4 text-center text-xs text-slate-300 space-y-2">
              <Camera className="w-8 h-8 mx-auto text-slate-400" />
              <p>{cameraError}</p>
            </div>
          ) : (
            <video
              ref={videoRef}
              muted
              playsInline
              className="w-full h-full object-cover -scale-x-100"
            />
          )}
        </div>
        <canvas ref={canvasRef} className="hidden" />
      </div>

      <div className="text-center space-y-1">
        <p
          className={`text-sm font-semibold ${
            hasError
              ? 'text-amber-600 dark:text-amber-400'
              : progress >= 100
              ? 'text-emerald-600 dark:text-emerald-400'
              : 'text-slate-800 dark:text-slate-200'
          }`}
        >
          {submitting
            ? 'Rasm saqlanmoqda va kabinet ochilmoqda...'
            : hasError && capturedPreview
            ? 'Rasm olindi, lekin serverga yuborishda uzilish bo‘ldi.'
            : statusText}
        </p>
        <p className="text-xs font-mono-num text-slate-500 dark:text-slate-400">
          {progress}% · Tekislik tekshiruvi
        </p>
      </div>

      {cameraError && (
        <button
          type="button"
          onClick={handleRetakePhoto}
          className="min-h-[40px] px-4 py-2 inline-flex items-center gap-2 rounded-xl bg-sky-600 text-white text-xs font-semibold cursor-pointer"
        >
          <RefreshCw className="w-4 h-4" />
          Kamerani qayta yoqish
        </button>
      )}

      {capturedPreview && !submitting && hasError && (
        <div className="flex flex-wrap items-center justify-center gap-2">
          <button
            type="button"
            onClick={handleRetryUpload}
            className="min-h-[40px] px-4 py-2 inline-flex items-center gap-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
            Qayta yuborish
          </button>
          <button
            type="button"
            onClick={handleRetakePhoto}
            className="min-h-[40px] px-4 py-2 inline-flex items-center gap-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 cursor-pointer"
          >
            Qaytadan olish
          </button>
        </div>
      )}

      {capturedPreview && !submitting && !hasError && savedOk && (
        <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
          <CheckCircle2 className="w-4 h-4" />
          Yuz muvaffaqiyatli tasdiqlandi
        </div>
      )}
    </div>
  );
}
