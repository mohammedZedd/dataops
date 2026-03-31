import { FileText } from 'lucide-react';

interface Props {
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export function EmptyState({ title, description, action }: Props) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="h-14 w-14 rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
        <FileText size={24} className="text-gray-300" />
      </div>
      <p className="text-[14px] font-semibold text-gray-700">{title}</p>
      {description && (
        <p className="text-[13px] text-gray-400 mt-1 max-w-xs">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
