import { X } from 'lucide-react';
import { tr } from '../i18n/translations.ts';
import type { Lang, UserProfile } from '../types/lms.ts';
import { CardTransferCheckout } from './CardTransferCheckout.tsx';

interface SubscriptionModalProps {
  lang: Lang;
  onClose: () => void;
  onActivated: (user: UserProfile) => void;
}

export function SubscriptionModal({
  lang,
  onClose,
  onActivated,
}: SubscriptionModalProps) {
  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5">
      <div className="w-full max-w-xl max-h-[92vh] overflow-y-auto rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 sm:p-6 shadow-2xl">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div>
            <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
              {tr(lang, 'paymentTitle')}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              30 kunlik barcha darslar, testlar, kitoblar va 12 til kursi
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[36px] min-w-[36px] inline-flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <CardTransferCheckout lang={lang} onActivated={onActivated} />
      </div>
    </div>
  );
}
