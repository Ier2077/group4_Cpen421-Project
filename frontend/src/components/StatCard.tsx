const ACCENTS: Record<string, string> = {
  blue: 'border-l-blue-500',
  green: 'border-l-emerald-500',
  red: 'border-l-red-500',
  amber: 'border-l-amber-500',
  gray: 'border-l-gray-400',
};

export default function StatCard({ label, value, sub, color = 'blue' }: { label: string; value: string | number; sub?: string; color?: 'blue' | 'green' | 'red' | 'amber' | 'gray' }) {
  return (
    <div className={`card border-l-4 ${ACCENTS[color]}`}>
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-gray-900">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-gray-400">{sub}</p>}
    </div>
  );
}
