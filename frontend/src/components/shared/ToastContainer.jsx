import { CheckCircle2, XCircle, Info, X } from 'lucide-react';
import { useToastStore } from '../../store/toastStore';
import clsx from 'clsx';

const STYLES = {
  success: {
    bar: 'bg-gray-900 text-white',
    icon: <CheckCircle2 className="w-4 h-4 text-project-400 flex-shrink-0" />,
  },
  error: {
    bar: 'bg-gray-900 text-white',
    icon: <XCircle className="w-4 h-4 text-actor-400 flex-shrink-0" />,
  },
  info: {
    bar: 'bg-gray-900 text-white',
    icon: <Info className="w-4 h-4 text-primary-400 flex-shrink-0" />,
  },
};

export default function ToastContainer() {
  const { toasts, removeToast } = useToastStore();

  if (!toasts.length) return null;

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[99999] flex flex-col items-center gap-2 pointer-events-none px-4 w-full max-w-sm">
      {toasts.map((toast) => {
        const style = STYLES[toast.type] || STYLES.success;
        return (
          <div
            key={toast.id}
            className={clsx(
              'pointer-events-auto w-full flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg text-sm font-medium',
              'animate-[slideUp_0.2s_ease-out]',
              style.bar
            )}
          >
            {style.icon}
            <span className="flex-1">{toast.message}</span>
            <button
              onClick={() => removeToast(toast.id)}
              className="text-white/50 hover:text-white transition-colors flex-shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
