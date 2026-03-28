import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { incidentApi } from '../api/incidents';
import PageHeader from '../components/PageHeader';
import StatusBadge from '../components/StatusBadge';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorMessage from '../components/ErrorMessage';
import { ArrowLeft, MapPin, Phone, Clock, Truck, Building2 } from 'lucide-react';
import { useAuth } from '../features/auth/AuthContext';
import type { Incident, IncidentStatus } from '../types';

const NEXT: Record<string, IncidentStatus[]> = { CREATED: ['DISPATCHED'], DISPATCHED: ['IN_PROGRESS'], IN_PROGRESS: ['RESOLVED'] };

export default function IncidentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [incident, setIncident] = useState<Incident | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;
    incidentApi.getById(id).then(setIncident).catch(() => setError('Incident not found')).finally(() => setLoading(false));
  }, [id]);

  const handleStatus = async (s: IncidentStatus) => {
    if (!id) return;
    setUpdating(true);
    try { setIncident(await incidentApi.updateStatus(id, s)); } catch { setError('Failed to update.'); }
    finally { setUpdating(false); }
  };

  if (loading) return <LoadingSpinner />;
  if (error || !incident) return <ErrorMessage message={error || 'Not found'} />;

  const next = NEXT[incident.status] || [];
  const canUpdate = ['system_admin','hospital_admin','police_admin','fire_admin'].includes(user?.role || '');

  return (
    <div className="max-w-3xl">
      <div className="mb-4">
        <Link to="/incidents" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700"><ArrowLeft className="h-3.5 w-3.5" /> Back to incidents</Link>
      </div>
      <PageHeader title={`Incident — ${incident.citizen_name}`}><StatusBadge status={incident.status} /></PageHeader>

      <div className="space-y-5">
        <div className="card">
          <h3 className="text-sm font-medium text-gray-900 mb-4">Overview</h3>
          <dl className="grid grid-cols-2 md:grid-cols-3 gap-y-4 gap-x-6 text-sm">
            <div><dt className="text-gray-500 flex items-center gap-1.5"><Phone className="h-3.5 w-3.5" /> Caller</dt><dd className="mt-0.5 font-medium text-gray-900">{incident.citizen_name}</dd>{incident.citizen_phone && <dd className="text-xs text-gray-400">{incident.citizen_phone}</dd>}</div>
            <div><dt className="text-gray-500">Type</dt><dd className="mt-1"><StatusBadge status={incident.incident_type} /></dd></div>
            <div><dt className="text-gray-500 flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" /> Location</dt><dd className="mt-0.5 font-mono text-xs text-gray-600">{incident.latitude.toFixed(4)}, {incident.longitude.toFixed(4)}</dd><dd className="text-xs text-gray-400">{incident.region || 'Unknown'}</dd></div>
            <div><dt className="text-gray-500 flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" /> Created</dt><dd className="mt-0.5 text-gray-900">{new Date(incident.created_at).toLocaleString()}</dd></div>
            {incident.dispatched_at && <div><dt className="text-gray-500">Dispatched</dt><dd className="mt-0.5 text-gray-900">{new Date(incident.dispatched_at).toLocaleString()}</dd></div>}
            {incident.resolved_at && <div><dt className="text-gray-500">Resolved</dt><dd className="mt-0.5 text-gray-900">{new Date(incident.resolved_at).toLocaleString()}</dd></div>}
          </dl>
          {incident.notes && <div className="mt-4 pt-4 border-t border-gray-100"><p className="text-sm text-gray-500 mb-1">Notes</p><p className="text-sm text-gray-700 bg-gray-50 rounded-md p-3">{incident.notes}</p></div>}
        </div>

        <div className="card">
          <h3 className="text-sm font-medium text-gray-900 mb-4">Assignment</h3>
          {incident.assigned_vehicle_id ? (
            <dl className="grid grid-cols-2 gap-y-4 gap-x-6 text-sm">
              <div><dt className="text-gray-500 flex items-center gap-1.5"><Truck className="h-3.5 w-3.5" /> Vehicle ID</dt><dd className="mt-0.5 font-mono text-xs text-gray-900">{incident.assigned_vehicle_id}</dd></div>
              <div><dt className="text-gray-500">Unit Type</dt><dd className="mt-1">{incident.assigned_unit_type ? <StatusBadge status={incident.assigned_unit_type} /> : '—'}</dd></div>
              {incident.assigned_hospital_name && <div className="col-span-2"><dt className="text-gray-500 flex items-center gap-1.5"><Building2 className="h-3.5 w-3.5" /> Hospital</dt><dd className="mt-0.5 font-medium text-gray-900">{incident.assigned_hospital_name}</dd></div>}
            </dl>
          ) : <p className="text-sm text-gray-400">No unit assigned yet</p>}
          {incident.assigned_vehicle_id && <Link to="/tracking" className="btn-secondary mt-4 text-xs"><MapPin className="h-3.5 w-3.5" /> Track on Map</Link>}
        </div>

        {canUpdate && next.length > 0 && (
          <div className="card">
            <h3 className="text-sm font-medium text-gray-900 mb-3">Update Status</h3>
            <div className="flex gap-3">
              {next.map((s) => (
                <button key={s} onClick={() => handleStatus(s)} disabled={updating} className={s === 'RESOLVED' ? 'btn-primary bg-emerald-600 hover:bg-emerald-700' : 'btn-primary'}>
                  {updating ? 'Updating…' : `Mark as ${s.replace(/_/g, ' ')}`}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
