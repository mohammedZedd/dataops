import { AlertCircle, RefreshCw } from 'lucide-react';

interface Props {
  message: string;
  onRetry?: () => void;
}

export function ErrorBanner({ message, onRetry }: Props) {
  return (
    <div className="flex items-center gap-3 bg-red-50 border border-red-100 rounded-xl px-4 py-3 mb-5">
      <AlertCircle size={15} className="text-red-500 flex-shrink-0" />
      <p className="text-[13px] text-red-700 flex-1">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="inline-flex items-center gap-1 text-[12px] font-medium text-red-600
            hover:text-red-700 transition-colors flex-shrink-0"
        >
          <RefreshCw size={11} />
          Réessayer
        </button>
      )}
    </div>
  );
}
