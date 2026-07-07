import React, { createContext, useContext, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Info, Loader2, X } from 'lucide-react';

type NoticeTone = 'info' | 'success' | 'error';

type ToastItem = {
  id: string;
  message: string;
  tone: NoticeTone;
};

type UiFeedbackContextValue = {
  showNotice: (message: string, tone?: NoticeTone) => void;
  confirmAction: (input: { title: string; message: string; confirmLabel?: string; tone?: 'default' | 'danger' }) => Promise<boolean>;
};

type ConfirmState = {
  title: string;
  message: string;
  confirmLabel: string;
  tone: 'default' | 'danger';
  resolve: (confirmed: boolean) => void;
} | null;

const UiFeedbackContext = createContext<UiFeedbackContextValue | null>(null);

function toneClasses(tone: NoticeTone) {
  if (tone === 'success') return 'border-emerald-200 bg-emerald-50 text-emerald-800';
  if (tone === 'error') return 'border-rose-200 bg-rose-50 text-rose-800';
  return 'border-sky-200 bg-sky-50 text-sky-800';
}

function ToneIcon({ tone }: { tone: NoticeTone }) {
  if (tone === 'success') return <CheckCircle2 className="h-4 w-4" />;
  if (tone === 'error') return <AlertTriangle className="h-4 w-4" />;
  return <Info className="h-4 w-4" />;
}

export function UiFeedbackProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [confirmState, setConfirmState] = useState<ConfirmState>(null);

  const value = useMemo<UiFeedbackContextValue>(
    () => ({
      showNotice: (message, tone = 'info') => {
        const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
        setToasts((current) => [...current, { id, message, tone }]);
        window.setTimeout(() => {
          setToasts((current) => current.filter((item) => item.id !== id));
        }, 4200);
      },
      confirmAction: ({ title, message, confirmLabel = 'Confirmar', tone = 'default' }) =>
        new Promise<boolean>((resolve) => {
          setConfirmState({
            title,
            message,
            confirmLabel,
            tone,
            resolve,
          });
        }),
    }),
    [],
  );

  const closeConfirm = (confirmed: boolean) => {
    setConfirmState((current) => {
      current?.resolve(confirmed);
      return null;
    });
  };

  return (
    <UiFeedbackContext.Provider value={value}>
      {children}

      <div className="pointer-events-none fixed right-4 top-4 z-[90] flex w-full max-w-sm flex-col gap-3">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto rounded-xl border px-4 py-3 text-sm shadow-lg ${toneClasses(toast.tone)}`}
            role="status"
            aria-live="polite"
          >
            <div className="flex items-start gap-3">
              <ToneIcon tone={toast.tone} />
              <span className="flex-1">{toast.message}</span>
              <button
                type="button"
                onClick={() => setToasts((current) => current.filter((item) => item.id !== toast.id))}
                className="rounded-md p-1 text-current/70 hover:bg-white/40"
                aria-label="Fechar aviso"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {confirmState && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/55 p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white shadow-2xl">
            <div className="border-b border-slate-200 px-5 py-4">
              <h3 className="text-base font-bold text-slate-900">{confirmState.title}</h3>
            </div>
            <div className="px-5 py-5 text-sm leading-relaxed text-slate-600">
              {confirmState.message}
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-4">
              <button
                type="button"
                onClick={() => closeConfirm(false)}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => closeConfirm(true)}
                className={`rounded-lg px-4 py-2 text-sm font-bold ${
                  confirmState.tone === 'danger'
                    ? 'bg-rose-600 text-white hover:bg-rose-700'
                    : 'bg-brand-secondary text-brand-darker hover:bg-brand-primary'
                }`}
              >
                {confirmState.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </UiFeedbackContext.Provider>
  );
}

export function useUiFeedback() {
  const context = useContext(UiFeedbackContext);
  if (!context) {
    throw new Error('useUiFeedback must be used within UiFeedbackProvider.');
  }
  return context;
}
