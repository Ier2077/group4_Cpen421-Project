import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { incidentApi } from '../api/incidents';
import PageHeader from '../components/PageHeader';
import type { IncidentType } from '../types';

const TYPES: { value: IncidentType; label: string }[] = [
  { value: 'medical', label: 'Medical Emergency' },
  { value: 'fire', label: 'Fire' },
  { value: 'crime', label: 'Crime' },
  { value: 'robbery', label: 'Robbery' },
  { value: 'assault', label: 'Assault' },
  { value: 'accident', label: 'Accident' },
  { value: 'other', label: 'Other' },
];

export default function NewIncidentPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ citizen_name: '', citizen_phone: '', incident_type: 'medical' as IncidentType, latitude: '', longitude: '', notes: '' });
  const set = (k: string, v: string) => setForm((p) => ({ ...p, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      const inc = await incidentApi.create({
        citizen_name: form.citizen_name,
        citizen_phone: form.citizen_phone || undefined,
        incident_type: form.incident_type,
        latitude: parseFloat(form.latitude),
        longitude: parseFloat(form.longitude),
        notes: form.notes || undefined,
      });
      navigate(`/incidents/${inc.id}`);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to create incident.');
    } finally { setLoading(false); }
  };

  return (
    <div className="max-w-2xl">
      <PageHeader title="Report Incident" description="Record a new emergency incident" />
      <div className="card">
        <form onSubmit={handleSubmit} className="space-y-5">
          {error && <div className="rounded-md bg-red-50 border border-red-200 px-3 py-2.5"><p className="text-sm text-red-700">{error}</p></div>}

          <fieldset>
            <legend className="text-sm font-medium text-gray-900 mb-3">Caller Information</legend>
            <div className="grid grid-cols-2 gap-4">
              <div><label className="label">Full Name *</label><input value={form.citizen_name} onChange={(e) => set('citizen_name', e.target.value)} className="input-field" required /></div>
              <div><label className="label">Phone Number</label><input value={form.citizen_phone} onChange={(e) => set('citizen_phone', e.target.value)} className="input-field" placeholder="+233…" /></div>
            </div>
          </fieldset>

          <fieldset>
            <legend className="text-sm font-medium text-gray-900 mb-3">Incident Details</legend>
            <div className="space-y-4">
              <div>
                <label className="label">Incident Type *</label>
                <select value={form.incident_type} onChange={(e) => set('incident_type', e.target.value)} className="input-field">
                  {TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="label">Latitude *</label><input type="number" step="any" value={form.latitude} onChange={(e) => set('latitude', e.target.value)} className="input-field" placeholder="5.5600" required /></div>
                <div><label className="label">Longitude *</label><input type="number" step="any" value={form.longitude} onChange={(e) => set('longitude', e.target.value)} className="input-field" placeholder="-0.2050" required /></div>
              </div>
              <div><label className="label">Notes</label><textarea value={form.notes} onChange={(e) => set('notes', e.target.value)} rows={3} className="input-field" placeholder="Additional details…" /></div>
            </div>
          </fieldset>

          <div className="flex items-center gap-3 pt-2">
            <button type="submit" disabled={loading} className="btn-primary">{loading ? 'Submitting…' : 'Report Incident'}</button>
            <button type="button" onClick={() => navigate('/incidents')} className="btn-secondary">Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
}
