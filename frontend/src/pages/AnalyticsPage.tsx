import { useEffect, useState } from 'react';
import { analyticsApi } from '../api/analytics';
import PageHeader from '../components/PageHeader';
import StatCard from '../components/StatCard';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorMessage from '../components/ErrorMessage';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import type { ResponseTimes, RegionData, ResourceUtilization } from '../types';

const COLORS = ['#2563eb', '#059669', '#d97706', '#dc2626', '#6366f1', '#64748b'];

export default function AnalyticsPage() {
  const [times, setTimes] = useState<ResponseTimes | null>(null);
  const [regions, setRegions] = useState<RegionData[]>([]);
  const [resources, setResources] = useState<ResourceUtilization | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([analyticsApi.getResponseTimes(), analyticsApi.getByRegion(), analyticsApi.getResourceUtilization()])
      .then(([t, r, u]) => { setTimes(t); setRegions(r); setResources(u); })
      .catch(() => setError('Failed to load analytics.'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingSpinner text="Loading analytics…" />;
  if (error) return <ErrorMessage message={error} />;

  const fmt = (s: number | null) => {
    if (s == null) return '—';
    if (s < 60) return `${Math.round(s)}s`;
    return `${Math.round(s / 60)}m ${Math.round(s % 60)}s`;
  };

  const regionTotals = Object.entries(regions.reduce<Record<string, number>>((a, r) => { a[r.region] = (a[r.region] || 0) + r.count; return a; }, {})).map(([region, count]) => ({ region, count }));
  const typeTotals = Object.entries(regions.reduce<Record<string, number>>((a, r) => { a[r.incident_type] = (a[r.incident_type] || 0) + r.count; return a; }, {})).map(([type, count]) => ({ type, count }));
  const statusData = resources ? Object.entries(resources.incidents_by_status).map(([name, value]) => ({ name, value })) : [];
  const unitData = resources ? Object.entries(resources.incidents_by_unit_type).map(([name, value]) => ({ name, value })) : [];

  const tooltipStyle = { fontSize: 12, border: '1px solid #e2e8f0', borderRadius: 6, boxShadow: '0 1px 3px rgba(0,0,0,0.08)' };

  return (
    <div>
      <PageHeader title="Analytics" description="Operational performance and incident data" />

      {times && (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
          <StatCard label="Total Incidents" value={times.total_incidents} color="blue" />
          <StatCard label="Avg Response" value={fmt(times.avg_response_time_seconds)} color="amber" />
          <StatCard label="Avg Resolution" value={fmt(times.avg_resolution_time_seconds)} color="green" />
          <StatCard label="Fastest" value={fmt(times.min_response_time_seconds)} color="green" />
          <StatCard label="Slowest" value={fmt(times.max_response_time_seconds)} color="red" />
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-6 mb-6">
        <div className="card">
          <h3 className="text-sm font-medium text-gray-900 mb-4">Incidents by Region</h3>
          {regionTotals.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={regionTotals} margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="region" tick={{ fontSize: 11, fill: '#64748b' }} />
                <YAxis tick={{ fontSize: 11, fill: '#64748b' }} allowDecimals={false} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="count" fill="#2563eb" radius={[3, 3, 0, 0]} name="Incidents" />
              </BarChart>
            </ResponsiveContainer>
          ) : <p className="text-sm text-gray-400 text-center py-12">No data</p>}
        </div>

        <div className="card">
          <h3 className="text-sm font-medium text-gray-900 mb-4">Incidents by Type</h3>
          {typeTotals.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={typeTotals} margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="type" tick={{ fontSize: 11, fill: '#64748b' }} />
                <YAxis tick={{ fontSize: 11, fill: '#64748b' }} allowDecimals={false} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="count" fill="#059669" radius={[3, 3, 0, 0]} name="Incidents" />
              </BarChart>
            </ResponsiveContainer>
          ) : <p className="text-sm text-gray-400 text-center py-12">No data</p>}
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="card">
          <h3 className="text-sm font-medium text-gray-900 mb-4">Incidents by Status</h3>
          {statusData.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={statusData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} innerRadius={50} paddingAngle={2}>
                  {statusData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          ) : <p className="text-sm text-gray-400 text-center py-12">No data</p>}
        </div>

        <div className="card">
          <h3 className="text-sm font-medium text-gray-900 mb-4">Response by Unit Type</h3>
          {unitData.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={unitData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} innerRadius={50} paddingAngle={2}>
                  {unitData.map((_, i) => <Cell key={i} fill={COLORS[(i + 2) % COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          ) : <p className="text-sm text-gray-400 text-center py-12">No data</p>}
        </div>
      </div>

      {resources && resources.top_deployed_vehicles.length > 0 && (
        <div className="card mt-6">
          <h3 className="text-sm font-medium text-gray-900 mb-4">Most Deployed Vehicles</h3>
          <table className="w-full text-sm">
            <thead><tr className="border-b border-gray-100">
              <th className="text-left px-3 py-2 font-medium text-gray-500 text-xs uppercase tracking-wider">Vehicle ID</th>
              <th className="text-left px-3 py-2 font-medium text-gray-500 text-xs uppercase tracking-wider">Unit Type</th>
              <th className="text-left px-3 py-2 font-medium text-gray-500 text-xs uppercase tracking-wider">Deployments</th>
            </tr></thead>
            <tbody className="divide-y divide-gray-50">
              {resources.top_deployed_vehicles.map((v, i) => (
                <tr key={i}>
                  <td className="px-3 py-2 font-mono text-xs text-gray-600">{v.vehicle_id.slice(0, 12)}…</td>
                  <td className="px-3 py-2 text-gray-600 capitalize">{v.unit_type || '—'}</td>
                  <td className="px-3 py-2 font-medium text-gray-900">{v.deployments}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
