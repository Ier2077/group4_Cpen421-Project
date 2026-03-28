export default function ErrorMessage({ message = 'Something went wrong.', onRetry }: { message?: string; onRetry?: () => void }) {
  return (
    <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center">
      <p className="text-sm text-red-700 mb-3">{message}</p>
      {onRetry && <button onClick={onRetry} className="btn-secondary text-sm">Try again</button>}
    </div>
  );
}
