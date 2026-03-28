const STYLES: Record<string, string> = {
  CREATED:     'bg-amber-50 text-amber-700 ring-1 ring-amber-200',
  DISPATCHED:  'bg-blue-50 text-blue-700 ring-1 ring-blue-200',
  IN_PROGRESS: 'bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200',
  RESOLVED:    'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',
  available:   'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',
  en_route:    'bg-blue-50 text-blue-700 ring-1 ring-blue-200',
  on_scene:    'bg-amber-50 text-amber-700 ring-1 ring-amber-200',
  returning:   'bg-gray-100 text-gray-600 ring-1 ring-gray-200',
  offline:     'bg-red-50 text-red-600 ring-1 ring-red-200',
  // incident / service types
  medical:     'bg-rose-50 text-rose-700 ring-1 ring-rose-200',
  fire:        'bg-orange-50 text-orange-700 ring-1 ring-orange-200',
  crime:       'bg-violet-50 text-violet-700 ring-1 ring-violet-200',
  robbery:     'bg-violet-50 text-violet-700 ring-1 ring-violet-200',
  assault:     'bg-red-50 text-red-700 ring-1 ring-red-200',
  accident:    'bg-amber-50 text-amber-700 ring-1 ring-amber-200',
  other:       'bg-gray-100 text-gray-600 ring-1 ring-gray-200',
  ambulance:   'bg-rose-50 text-rose-700 ring-1 ring-rose-200',
  police:      'bg-blue-50 text-blue-700 ring-1 ring-blue-200',
};

export default function StatusBadge({ status }: { status: string }) {
  const style = STYLES[status] || 'bg-gray-100 text-gray-600 ring-1 ring-gray-200';
  return <span className={`badge ${style}`}>{status.replace(/_/g, ' ')}</span>;
}
