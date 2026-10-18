import React from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info';
  message: string;
}

interface ToastContainerProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

export const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, onDismiss }) => {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col space-y-2.5 max-w-sm w-full pointer-events-none">
      {toasts.map((toast) => {
        const isSuccess = toast.type === 'success';
        const isError = toast.type === 'error';

        return (
          <div
            key={toast.id}
            className={`pointer-events-auto flex items-start justify-between p-4 rounded-xl border backdrop-blur-md shadow-2xl transition-all duration-300 animate-slideUp font-mono text-xs ${
              isSuccess
                ? 'bg-emerald-50/95 border-emerald-300 text-emerald-900 shadow-emerald-200/40 dark:bg-[#0b1b1f]/95 dark:border-emerald-500/60 dark:text-emerald-300 dark:shadow-[0_0_20px_rgba(16,185,129,0.2)]'
                : isError
                ? 'bg-rose-50/95 border-rose-300 text-rose-900 shadow-rose-200/40 dark:bg-[#1f0b0f]/95 dark:border-rose-500/60 dark:text-rose-300 dark:shadow-[0_0_20px_rgba(244,63,94,0.2)]'
                : 'bg-cyan-50/95 border-cyan-300 text-cyan-900 shadow-cyan-200/40 dark:bg-slate-900/95 dark:border-cyan-500/60 dark:text-cyan-300 dark:shadow-[0_0_20px_rgba(6,182,212,0.2)]'
            }`}
          >
            <div className="flex items-start space-x-2.5">
              {isSuccess && <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 mt-0.5 flex-shrink-0" />}
              {isError && <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 mt-0.5 flex-shrink-0" />}
              {!isSuccess && !isError && <Info className="w-4 h-4 text-cyan-600 dark:text-cyan-400 mt-0.5 flex-shrink-0" />}
              <span className="leading-snug">{toast.message}</span>
            </div>
            <button
              onClick={() => onDismiss(toast.id)}
              className="ml-3 p-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white transition"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
};

export default ToastContainer;
