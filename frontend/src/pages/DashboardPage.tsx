import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../features/auth/AuthContext';
import { incidentApi } from '../api/incidents';
import { vehicleApi } from '../api/vehicles';
import { analyticsApi } from '../api/analytics';
import StatCard from '../components/StatCard';
import StatusBadge from '../components/StatusBadge';
import LoadingSpinner from '../components/LoadingSpinner';
import PageHeader from '../components/PageHeader';
import { AlertTriangle, Truck, ArrowRight, MapPin } from 'lucide-react';
import type { Incident, Vehicle, ResponseTimes } from '../types';

export default function DashboardPage() {
  const { user } = useAuth();
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [stats, setStats] = useState<ResponseTimes | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [inc, veh] = await Promise.all([
          incidentApi.getOpen().catch(() => []),
          vehicleApi.getAll().catch(() => []),
        ]);
        setIncidents(inc);
        setVehicles(veh);
        if (user?.role !== 'ambulance_driver') {
          const s = await analyticsApi.getResponseTimes().catch(() => null);
          setStats(s);
        }
      } finally { setLoading(false); }
    };
    load();
  }, [user]);

  if (loading) return <LoadingSpinner />;

  const available = vehicles.filter((v) => v.is_available).length;
  const deployed = vehicles.filter((v) => !v.is_available).length;

  // Ambulance driver view
  if (user?.role === 'ambulance_driver') {
    const myVehicle = vehicles.find((v) => v.incident_id);
    const myIncident = myVehicle ? incidents.find((i) => i.id === myVehicle.incident_id) : null;
    return (
      <div>
        <PageHeader title="My Assignment" description="Current dispatch status" />
        {myIncident ? (
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-gray-900">Active Incident</h3>
              <StatusBadge status={myIncident.status} />
            </div>
            <dl className="grid grid-cols-2 gap-4 text-sm">
              <div><dt className="text-gray-500">Type</dt><dd className="mt-0.5"><StatusBadge status={myIncident.incident_type} /></dd></div>
              <div><dt className="text-gray-500">Caller</dt><dd className="mt-0.5 font-medium text-gray-900">{myIncident.citizen_name}</dd></div>
              <div><dt className="text-gray-500">Location</dt><dd className="mt-0.5 font-mono text-xs text-gray-600">{myIncident.latitude.toFixed(4)}, {myIncident.longitude.toFixed(4)}</dd></div>
              <div><dt className="text-gray-500">Region</dt><dd className="mt-0.5 text-gray-900">{myIncident.region || '—'}</dd></div>
            </dl>
            {myIncident.notes && <p className="mt-4 text-sm text-gray-600 bg-gray-50 rounded-md p-3">{myIncident.notes}</p>}
            <Link to="/tracking" className="btn-primary mt-4 w-full"><MapPin className="h-4 w-4" /> Open Tracking Map</Link>
          </div>
        ) : (
          <div className="card text-center py-12">
            <Truck className="h-8 w-8 text-gray-300 mx-auto mb-3" />
            <p className="text-sm font-medium text-gray-900">No active assignment</p>
            <p className="text-sm text-gray-500 mt-1">You are currently not dispatched to any incident.</p>
          </div>
        )}
      </div>
    );
  }

  const roleTitle: Record<string, string> = {
    system_admin: 'System Overview', hospital_admin: 'Medical Operations',
    police_admin: 'Police Operations', fire_admin: 'Fire Operations',
  };

  return (
    <div>
      <PageHeader title={roleTitle[user?.role || ''] || 'Dashboard'} description={`Welcome back, ${user?.name}`} />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Open Incidents" value={incidents.length} color="red" />
        <StatCard label="Available Units" value={available} color="green" />
        <StatCard label="Deployed Units" value={deployed} color="blue" />
        <StatCard label="Avg Response" value={stats ? `${Math.round(stats.avg_response_time_seconds)}s` : '—'} color="amber" />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Recent incidents */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-gray-900 flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-gray-400" /> Open Incidents</h3>
            <Link to="/incidents" className="text-xs text-brand-600 hover:text-brand-700 flex items-center gap-1">View all <ArrowRight className="h-3 w-3" /></Link>
          </div>
          {incidents.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">No open incidents</p>
          ) : (
            <div className="space-y-2">
              {incidents.slice(0, 5).map((inc) => (
                <Link key={inc.id} to={`/incidents/${inc.id}`} className="flex items-center justify-between rounded-md border border-gray-100 px-3 py-2.5 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center gap-3">
                    <StatusBadge status={inc.incident_type} />
                    <div>
                      <p className="text-sm font-medium text-gray-900">{inc.citizen_name}</p>
                      <p className="text-xs text-gray-400">{inc.region || 'Unknown region'}</p>
                    </div>
                  </div>
                  <StatusBadge status={inc.status} />
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Fleet status */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-gray-900 flex items-center gap-2"><Truck className="h-4 w-4 text-gray-400" /> Fleet Status</h3>
            <Link to="/vehicles" className="text-xs text-brand-600 hover:text-brand-700 flex items-center gap-1">View all <ArrowRight className="h-3 w-3" /></Link>
          </div>
          <div className="space-y-3">
            {(['ambulance', 'police', 'fire'] as const).map((type) => {
              const ofType = vehicles.filter((v) => v.service_type === type);
              const avail = ofType.filter((v) => v.is_available).length;
              return (
                <div key={type} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <StatusBadge status={type} />
                    <span className="text-sm text-gray-600 capitalize">{type}</span>
                  </div>
                  <div className="text-sm">
                    <span className="font-medium text-emerald-600">{avail}</span>
                    <span className="text-gray-400"> / {ofType.length} available</span>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-5 pt-4 border-t border-gray-100">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Currently Deployed</p>
            {deployed === 0 ? (
              <p className="text-sm text-gray-400">No units deployed</p>
            ) : (
              <div className="space-y-1.5">
                {vehicles.filter((v) => !v.is_available).slice(0, 4).map((v) => (
                  <div key={v.id} className="flex items-center justify-between text-sm">
                    <span className="font-mono text-xs text-gray-600">{v.plate_number}</span>
                    <StatusBadge status={v.vehicle_status} />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
