import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import type { Toast as ToastItem } from '../../types';

const ICONS = { success: CheckCircle, error: XCircle, warning: AlertTriangle, info: Info };
const STYLES = {
  success: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300',
  error: 'border-rose-500/40 bg-rose-500/10 text-rose-300',
  warning: 'border-amber-500/40 bg-amber-500/10 text-amber-300',
  info: 'border-sky-500/40 bg-sky-500/10 text-sky-300',
};

function ToastCard({ toast }: { toast: ToastItem }) {
  const { removeToast } = useApp();
  const Icon = ICONS[toast.type];
  return (
    <div className={`flex items-start gap-3 px-4 py-3 rounded-lg border backdrop-blur-sm text-sm animate-slide-in ${STYLES[toast.type]}`}>
      <Icon size={16} className="mt-0.5 flex-shrink-0" />
      <span className="flex-1">{toast.message}</span>
      <button onClick={() => removeToast(toast.id)} className="opacity-60 hover:opacity-100 transition-opacity">
        <X size={14} />
      </button>
    </div>
  );
}

export function ToastContainer() {
  const { toasts } = useApp();
  if (toasts.length === 0) return null;
  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full">
      {toasts.map((t) => <ToastCard key={t.id} toast={t} />)}
    </div>
  );
}
