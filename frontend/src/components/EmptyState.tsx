export default function EmptyState({ title, description }: { title: string; description?: string }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-12 text-center">
      <p className="text-sm font-medium text-gray-900 mb-1">{title}</p>
      {description && <p className="text-sm text-gray-500">{description}</p>}
    </div>
  );
}
