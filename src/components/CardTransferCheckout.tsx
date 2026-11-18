import { useEffect, useState } from 'react';
import {
  AlertCircle,
  Calendar,
  Check,
  CheckCircle2,
  Copy,
  CreditCard,
  ExternalLink,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react';
import { tr } from '../i18n/translations.ts';
import { apiFetch, getStoredToken } from '../lib/api.ts';
import type {
  IntegrationStatus,
  Lang,
  PaymentOrder,
  PaymentProvider,
  UserProfile,
} from '../types/lms.ts';

interface CardTransferCheckoutProps {
  lang: Lang;
  onActivated: (user: UserProfile) => void;
}

interface CheckoutLinksResponse {
  orderId: string;
  amount: number;
  days: number;
  integrationStatus: IntegrationStatus;
  links: Record<PaymentProvider, string>;
}

const PROVIDERS: {
  id: PaymentProvider;
  label: string;
  accent: string;
  fallbackUrl: string;
}[] = [
  {
    id: 'click',
    label: 'Click',
    accent: 'border-sky-500 bg-sky-50/70 dark:bg-sky-950/50 text-sky-800 dark:text-sky-200 hover:bg-sky-100 dark:hover:bg-sky-950',
    fallbackUrl: 'https://my.click.uz/',
  },
  {
    id: 'payme',
    label: 'Payme',
    accent: 'border-teal-500 bg-teal-50/70 dark:bg-teal-950/50 text-teal-800 dark:text-teal-200 hover:bg-teal-100 dark:hover:bg-teal-950',
    fallbackUrl: 'https://payme.uz/',
  },
  {
    id: 'uzum',
    label: 'Uzum Bank',
    accent: 'border-violet-500 bg-violet-50/70 dark:bg-violet-950/50 text-violet-800 dark:text-violet-200 hover:bg-violet-100 dark:hover:bg-violet-950',
    fallbackUrl: 'https://uzumbank.uz/',
  },
  {
    id: 'paynet',
    label: 'Paynet',
    accent: 'border-emerald-500 bg-emerald-50/70 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-200 hover:bg-emerald-100 dark:hover:bg-emerald-950',
    fallbackUrl: 'https://paynet.uz/',
  },
  {
    id: 'anorbank',
    label: 'Anorbank',
    accent: 'border-rose-500 bg-rose-50/70 dark:bg-rose-950/50 text-rose-800 dark:text-rose-200 hover:bg-rose-100 dark:hover:bg-rose-950',
    fallbackUrl: 'https://anorbank.uz/',
  },
  {
    id: 'oson',
    label: 'Oson',
    accent: 'border-indigo-500 bg-indigo-50/70 dark:bg-indigo-950/50 text-indigo-800 dark:text-indigo-200 hover:bg-indigo-100 dark:hover:bg-indigo-950',
    fallbackUrl: 'https://oson.uz/',
  },
];

function formatCard(card: string): string {
  const digits = card.replace(/\D/g, '');
  return digits.replace(/(\d{4})(?=\d)/g, '$1 ');
}

export function CardTransferCheckout({ lang, onActivated }: CardTransferCheckoutProps) {
  const [checkoutInfo, setCheckoutInfo] = useState<CheckoutLinksResponse | null>(null);
  const [launchedProvider, setLaunchedProvider] = useState<PaymentProvider | null>(null);
  const [copied, setCopied] = useState(false);
  const [polling, setPolling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<CheckoutLinksResponse>('/api/payments/checkout-links')
      .then((res) => setCheckoutInfo(res))
      .catch(() => {});
  }, []);

  // Poll server for real Click/Payme webhook payment confirmation after user opens payment app
  useEffect(() => {
    if (!launchedProvider || !checkoutInfo?.orderId || successMsg) return;
    const timer = setInterval(async () => {
      try {
        const res = await apiFetch<{ order: PaymentOrder; user: UserProfile }>(
          `/api/payments/orders/${checkoutInfo.orderId}`
        );
        if (res.order.status === 'paid') {
          setSuccessMsg(tr(lang, 'paymentAccepted'));
          setTimeout(() => onActivated(res.user), 700);
        }
      } catch {
        // ignore until order is persisted or confirmed
      }
    }, 2500);
    return () => clearInterval(timer);
  }, [launchedProvider, checkoutInfo?.orderId, lang, onActivated, successMsg]);

  const statusInfo = checkoutInfo?.integrationStatus;
  const price = checkoutInfo?.amount || 10000;
  const days = checkoutInfo?.days || 30;
  const cardDisplay = formatCard(statusInfo?.recipientCard || '5614682014970760');
  const isClickLive = Boolean(statusInfo?.clickConfigured);

  async function handleCopyCard() {
    try {
      await navigator.clipboard.writeText(
        statusInfo?.recipientCard || '5614682014970760'
      );
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  }

  function handleLaunchApp(provider: PaymentProvider) {
    setError(null);
    setLaunchedProvider(provider);
    if (!checkoutInfo) return;
    const token = getStoredToken();
    fetch('/api/payments/create-order', {
      method: 'POST',
      keepalive: true,
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        orderId: checkoutInfo.orderId,
        provider,
        amount: price,
      }),
    }).catch(() => {});
  }

  async function handleCheckNow() {
    if (!checkoutInfo?.orderId) return;
    setPolling(true);
    setError(null);
    try {
      const res = await apiFetch<{ order: PaymentOrder; user: UserProfile }>(
        `/api/payments/orders/${checkoutInfo.orderId}`
      );
      if (res.order.status === 'paid') {
        setSuccessMsg(tr(lang, 'paymentAccepted'));
        setTimeout(() => onActivated(res.user), 700);
      } else {
        setError(
          isClickLive
            ? 'To‘lov hali Click serveridan tasdiqlanmadi. Ilovada to‘lovni yakunlab qayta tekshiring.'
            : 'To‘lov hali tasdiqlanmadi. Ilovada to‘lovni yakunlaganingizdan so‘ng biroz kuting.'
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'To‘lov holatini tekshirib bo‘lmadi');
    } finally {
      setPolling(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* 1. Subscription Duration & Exact Price First */}
      <div className="rounded-xl border border-sky-200 dark:border-sky-800 bg-sky-50/60 dark:bg-sky-950/40 p-4 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <Calendar className="w-5 h-5 text-sky-600 dark:text-sky-400 shrink-0" />
            <div>
              <p className="text-xs text-slate-600 dark:text-slate-400">Obuna muddati</p>
              <p className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white font-mono-num">
                {days} kun
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs text-slate-600 dark:text-slate-400">To‘lov narxi</p>
            <p className="text-lg sm:text-xl font-extrabold text-sky-700 dark:text-sky-300 font-mono-num">
              {price.toLocaleString()} so‘m
            </p>
          </div>
        </div>

        <div className="pt-3 border-t border-sky-200/80 dark:border-sky-800/80 flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              {tr(lang, 'recipientCardLabel')}
            </p>
            <p className="text-sm sm:text-base font-mono-num font-bold text-slate-900 dark:text-white tracking-wider">
              {cardDisplay}
            </p>
          </div>
          <button
            type="button"
            onClick={handleCopyCard}
            className="min-h-[36px] px-3 py-1.5 inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-medium text-slate-700 dark:text-slate-200 cursor-pointer"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                {tr(lang, 'copied')}
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                {tr(lang, 'copyCard')}
              </>
            )}
          </button>
        </div>

        <div className="flex items-center gap-2 text-[11px] text-slate-600 dark:text-slate-400">
          <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>
            Sayt karta PIN-kodi yoki SMS-kod so‘ramaydi. To‘lov faqat tanlangan ilovaning o‘zida amalga oshiriladi.
          </span>
        </div>
      </div>

      {/* 2. Direct Payment App Links Below */}
      <div className="space-y-2">
        <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
          To‘lash uchun ilovani tanlang (darhol ilovaga o‘tadi):
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
          {PROVIDERS.map((p) => {
            const href = checkoutInfo?.links?.[p.id] || p.fallbackUrl;
            const isLaunched = launchedProvider === p.id;
            return (
              <a
                key={p.id}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => handleLaunchApp(p.id)}
                className={`min-h-[48px] px-3 py-2.5 rounded-xl border text-sm font-semibold flex items-center justify-center gap-2 transition-colors ${p.accent} ${
                  isLaunched ? 'ring-2 ring-sky-500/40' : ''
                }`}
              >
                <CreditCard className="w-4 h-4 shrink-0" />
                <span>{p.label}</span>
                <ExternalLink className="w-3.5 h-3.5 opacity-75 shrink-0" />
              </a>
            );
          })}
        </div>
      </div>

      {/* 3. Real Waiting / Verification State after opening app */}
      {launchedProvider && !successMsg && (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-3">
          <div className="flex items-center justify-between gap-2 text-xs">
            <span className="font-semibold text-slate-900 dark:text-white">
              To‘lov kutilmoqda ({launchedProvider.toUpperCase()} · {price.toLocaleString()} so‘m)
            </span>
            <span className="font-mono-num text-slate-500">{checkoutInfo?.orderId}</span>
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-400">
            Ilovada to‘lovni yakunlab bo‘lganingizdan so‘ng tasdiqlanishini kuting yoki tekshirish tugmasini bosing. Tasdiqlangach kabinetga avtomatik kiriladi.
          </p>
          <button
            type="button"
            disabled={polling}
            onClick={handleCheckNow}
            className="min-h-[40px] px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold inline-flex items-center gap-2 cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${polling ? 'animate-spin' : ''}`} />
            To‘lovni tekshirish
          </button>
        </div>
      )}

      {/* Clean configuration notice when Click Merchant API keys aren't connected yet */}
      {statusInfo && !isClickLive && !successMsg && (
        <div className="rounded-xl border border-amber-200 dark:border-amber-800/80 bg-amber-50/70 dark:bg-amber-950/30 p-3 text-xs text-amber-900 dark:text-amber-200 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <p className="leading-relaxed">
            Avtomatik tasdiqlash uchun serverda Click Merchant kalitlari sozlanishi kerak; ungacha administrator o‘tkazmani tasdiqlagach kabinet ochiladi.
          </p>
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/40 p-3 text-xs text-rose-700 dark:text-rose-300">
          {error}
        </div>
      )}

      {successMsg && (
        <div className="rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 p-3.5 text-sm font-semibold text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}
    </div>
  );
}
