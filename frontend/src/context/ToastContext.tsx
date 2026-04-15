import { createContext, useContext, useState, useCallback, useRef } from 'react';
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

type ToastVariant = 'success' | 'error' | 'warning' | 'info';

interface Toast {
  id: string;
  message: string;
  variant: ToastVariant;
}

interface ToastCtx {
  success: (msg: string) => void;
  error:   (msg: string) => void;
  warning: (msg: string) => void;
  info:    (msg: string) => void;
}

// ─── Context ──────────────────────────────────────────────────────────────────

const ToastContext = createContext<ToastCtx>({
  success: () => {},
  error:   () => {},
  warning: () => {},
  info:    () => {},
});

export function useToast() {
  return useContext(ToastContext);
}

// ─── Config visuelle ──────────────────────────────────────────────────────────

const VARIANT_CFG: Record<ToastVariant, {
  bg: string; border: string; text: string;
  icon: React.ReactNode;
}> = {
  success: {
    bg: '#F0FDF4', border: '#BBF7D0', text: '#166534',
    icon: <CheckCircle size={16} color="#16A34A" />,
  },
  error: {
    bg: '#FEF2F2', border: '#FECACA', text: '#991B1B',
    icon: <XCircle size={16} color="#DC2626" />,
  },
  warning: {
    bg: '#FFFBEB', border: '#FDE68A', text: '#92400E',
    icon: <AlertTriangle size={16} color="#D97706" />,
  },
  info: {
    bg: '#EFF6FF', border: '#BFDBFE', text: '#1E40AF',
    icon: <Info size={16} color="#3B82F6" />,
  },
};

// ─── Provider + Toaster ───────────────────────────────────────────────────────

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const counter = useRef(0);

  const dismiss = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const push = useCallback((message: string, variant: ToastVariant) => {
    const id = `toast-${++counter.current}`;
    setToasts(prev => [...prev.slice(-4), { id, message, variant }]); // max 5 toasts
    setTimeout(() => dismiss(id), 4000);
  }, [dismiss]);

  const ctx: ToastCtx = {
    success: (msg) => push(msg, 'success'),
    error:   (msg) => push(msg, 'error'),
    warning: (msg) => push(msg, 'warning'),
    info:    (msg) => push(msg, 'info'),
  };

  return (
    <ToastContext.Provider value={ctx}>
      {children}

      {/* Toaster — coin inférieur droit, au-dessus de tout */}
      <div style={{
        position: 'fixed', bottom: 24, right: 24,
        display: 'flex', flexDirection: 'column', gap: 10,
        zIndex: 99999, pointerEvents: 'none',
      }}>
        {toasts.map(toast => {
          const cfg = VARIANT_CFG[toast.variant];
          return (
            <div
              key={toast.id}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                minWidth: 280, maxWidth: 380,
                background: cfg.bg,
                border: `1px solid ${cfg.border}`,
                borderRadius: 10,
                padding: '12px 14px',
                boxShadow: '0 4px 16px rgba(0,0,0,0.10)',
                pointerEvents: 'all',
                animation: 'toastIn 0.2s ease',
              }}
            >
              <span style={{ flexShrink: 0 }}>{cfg.icon}</span>
              <span style={{ flex: 1, fontSize: 13, fontWeight: 500, color: cfg.text, lineHeight: 1.4 }}>
                {toast.message}
              </span>
              <button
                onClick={() => dismiss(toast.id)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, color: cfg.text, opacity: 0.5, flexShrink: 0 }}
              >
                <X size={14} />
              </button>
            </div>
          );
        })}
      </div>

      <style>{`
        @keyframes toastIn {
          from { opacity: 0; transform: translateY(8px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </ToastContext.Provider>
  );
}
