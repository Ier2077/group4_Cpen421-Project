import { Loader2 } from 'lucide-react';

export default function LoadingSpinner({ text = 'Loading…' }: { text?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-gray-400">
      <Loader2 className="h-8 w-8 animate-spin mb-3" />
      <p className="text-sm">{text}</p>
    </div>
  );
}
