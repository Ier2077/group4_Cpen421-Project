import { useEffect, useState } from 'react';
import { vehicleApi } from '../api/vehicles';
import PageHeader from '../components/PageHeader';
import StatusBadge from '../components/StatusBadge';
import LoadingSpinner from '../components/LoadingSpinner';
import EmptyState from '../components/EmptyState';
import { useAuth } from '../features/auth/AuthContext';
import type { Vehicle } from '../types';

// Map roles to the vehicle type they can see
const ROLE_VEHICLE_FILTER: Record<string, string | null> = {
  system_admin: null,        // sees all
  hospital_admin: 'ambulance',
  police_admin: 'police',
  fire_admin: 'fire',
};

const ALL_FILTERS = [
  { value: '', label: 'All Units' },
  { value: 'ambulance', label: 'Ambulance' },
  { value: 'police', label: 'Police' },
  { value: 'fire', label: 'Fire' },
];

export default function VehiclesPage() {
  const { user } = useAuth();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [filter, setFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [locForm, setLocForm] = useState<{ id: string; lat: string; lng: string } | null>(null);

  // Determine if this user is locked to a specific vehicle type
  const roleFilter = user ? ROLE_VEHICLE_FILTER[user.role] ?? null : null;
  const isSystemAdmin = user?.role === 'system_admin';

  // The effective filter: role-locked admins always use their type, system_admin can choose
  const effectiveFilter = isSystemAdmin ? (filter || undefined) : (roleFilter || undefined);

  useEffect(() => {
    setLoading(true);
    vehicleApi.getAll(effectiveFilter).then(setVehicles).finally(() => setLoading(false));
  }, [effectiveFilter]);

  const saveLoc = async () => {
    if (!locForm) return;
    try {
      const u = await vehicleApi.updateLocation(locForm.id, parseFloat(locForm.lat), parseFloat(locForm.lng));
      setVehicles((p) => p.map((v) => (v.id === u.id ? u : v)));
      setLocForm(null);
    } catch { alert('Failed to update location.'); }
  };

  if (loading) return <LoadingSpinner />;
  const avail = vehicles.filter((v) => v.is_available).length;

  // Page title based on role
  const pageTitle = isSystemAdmin
    ? 'Vehicles'
    : roleFilter
      ? `${roleFilter.charAt(0).toUpperCase() + roleFilter.slice(1)} Fleet`
      : 'Vehicles';

  return (
    <div>
      <PageHeader title={pageTitle} description={`${avail} of ${vehicles.length} units available`}>
        {/* Only system_admin sees filter buttons */}
        {isSystemAdmin && (
          <div className="flex items-center gap-2">
            {ALL_FILTERS.map((f) => (
              <button key={f.value} onClick={() => setFilter(f.value)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${filter === f.value ? 'bg-brand-50 text-brand-700 ring-1 ring-brand-200' : 'bg-white text-gray-600 ring-1 ring-gray-200 hover:bg-gray-50'}`}>
                {f.label}
              </button>
            ))}
          </div>
        )}
      </PageHeader>

      {vehicles.length === 0 ? <EmptyState title="No vehicles found" /> : (
        <div className="card p-0 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/60">
                <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider">Plate</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider">Type</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider">Personnel</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider">Status</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider">Location</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider">Avail</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {vehicles.map((v) => (
                <tr key={v.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs font-medium text-gray-900">{v.plate_number}</td>
                  <td className="px-4 py-3"><StatusBadge status={v.service_type} /></td>
                  <td className="px-4 py-3 text-gray-600">{v.assigned_personnel_name || '—'}</td>
                  <td className="px-4 py-3"><StatusBadge status={v.vehicle_status} /></td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-500">{v.latitude.toFixed(4)}, {v.longitude.toFixed(4)}</td>
                  <td className="px-4 py-3">{v.is_available ? <span className="h-2 w-2 rounded-full bg-emerald-500 inline-block" /> : <span className="h-2 w-2 rounded-full bg-gray-300 inline-block" />}</td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => setLocForm({ id: v.id, lat: String(v.latitude), lng: String(v.longitude) })} className="text-xs text-brand-600 hover:text-brand-700 font-medium">Update Loc</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {locForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="card w-full max-w-sm mx-4">
            <h3 className="text-sm font-medium text-gray-900 mb-4">Update Vehicle Location</h3>
            <div className="space-y-3">
              <div><label className="label">Latitude</label><input type="number" step="any" value={locForm.lat} onChange={(e) => setLocForm({ ...locForm, lat: e.target.value })} className="input-field" /></div>
              <div><label className="label">Longitude</label><input type="number" step="any" value={locForm.lng} onChange={(e) => setLocForm({ ...locForm, lng: e.target.value })} className="input-field" /></div>
            </div>
            <div className="flex gap-3 mt-4">
              <button onClick={saveLoc} className="btn-primary">Save</button>
              <button onClick={() => setLocForm(null)} className="btn-secondary">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
