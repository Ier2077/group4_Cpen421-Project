import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { incidentApi } from '../api/incidents';
import PageHeader from '../components/PageHeader';
import StatusBadge from '../components/StatusBadge';
import LoadingSpinner from '../components/LoadingSpinner';
import EmptyState from '../components/EmptyState';
import { Plus } from 'lucide-react';
import { useAuth } from '../features/auth/AuthContext';
import type { Incident } from '../types';

export default function IncidentsPage() {
  const { user } = useAuth();
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { incidentApi.getOpen().then(setIncidents).finally(() => setLoading(false)); }, []);

  if (loading) return <LoadingSpinner />;

  return (
    <div>
      <PageHeader title="Incidents" description={`${incidents.length} open incidents`}>
        {user?.role === 'system_admin' && (
          <Link to="/incidents/new" className="btn-primary"><Plus className="h-4 w-4" /> Report Incident</Link>
        )}
      </PageHeader>

      {incidents.length === 0 ? (
        <EmptyState title="No open incidents" description="All incidents have been resolved." />
      ) : (
        <div className="card p-0 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/60">
                <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider">Caller</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider">Type</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider">Region</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider">Status</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider">Vehicle</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider">Created</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {incidents.map((inc) => (
                <tr key={inc.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900">{inc.citizen_name}</p>
                    {inc.citizen_phone && <p className="text-xs text-gray-400">{inc.citizen_phone}</p>}
                  </td>
                  <td className="px-4 py-3"><StatusBadge status={inc.incident_type} /></td>
                  <td className="px-4 py-3 text-gray-600">{inc.region || '—'}</td>
                  <td className="px-4 py-3"><StatusBadge status={inc.status} /></td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-500">{inc.assigned_vehicle_id?.slice(0, 8) || '—'}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{new Date(inc.created_at).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</td>
                  <td className="px-4 py-3 text-right">
                    <Link to={`/incidents/${inc.id}`} className="text-xs text-brand-600 hover:text-brand-700 font-medium">View →</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
