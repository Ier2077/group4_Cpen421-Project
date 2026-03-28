import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { incidentApi } from '../api/incidents';
import PageHeader from '../components/PageHeader';
import { MapPin } from 'lucide-react';
import type { IncidentType } from '../types';

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const redIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34],
});

const TYPES: { value: IncidentType; label: string }[] = [
  { value: 'medical', label: 'Medical Emergency' },
  { value: 'fire', label: 'Fire' },
  { value: 'crime', label: 'Crime' },
  { value: 'robbery', label: 'Robbery' },
  { value: 'assault', label: 'Assault' },
  { value: 'accident', label: 'Accident' },
  { value: 'other', label: 'Other' },
];

function LocationPicker({ position, onPick }: { position: [number, number] | null; onPick: (lat: number, lng: number) => void }) {
  useMapEvents({ click(e) { onPick(e.latlng.lat, e.latlng.lng); } });
  return position ? <Marker position={position} icon={redIcon} /> : null;
}

export default function NewIncidentPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    citizen_name: '', citizen_phone: '',
    incident_type: 'medical' as IncidentType,
    latitude: '', longitude: '', notes: '',
  });
  const set = (k: string, v: string) => setForm((p) => ({ ...p, [k]: v }));

  const mapPosition: [number, number] | null =
    form.latitude && form.longitude ? [parseFloat(form.latitude), parseFloat(form.longitude)] : null;

  const handleMapClick = (lat: number, lng: number) => {
    setForm((p) => ({ ...p, latitude: lat.toFixed(6), longitude: lng.toFixed(6) }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!form.latitude || !form.longitude) { setError('Please click on the map to set the incident location.'); return; }
    setLoading(true);
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
    <div className="max-w-3xl">
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

              <div>
                <label className="label flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" /> Incident Location *</label>
                <p className="text-xs text-gray-400 mb-2">Click on the map to set the incident location</p>
                <div className="rounded-lg border border-gray-200 overflow-hidden" style={{ height: 320 }}>
                  <MapContainer center={[5.56, -0.20]} zoom={12} style={{ height: '100%', width: '100%' }} scrollWheelZoom>
                    <TileLayer attribution='&copy; OpenStreetMap' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                    <LocationPicker position={mapPosition} onPick={handleMapClick} />
                  </MapContainer>
                </div>
                {mapPosition && (
                  <p className="text-xs text-emerald-600 mt-1.5 flex items-center gap-1">
                    <MapPin className="h-3 w-3" /> Location set: {form.latitude}, {form.longitude}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div><label className="label">Latitude</label><input type="number" step="any" value={form.latitude} onChange={(e) => set('latitude', e.target.value)} className="input-field bg-gray-50" placeholder="Set by clicking map" readOnly /></div>
                <div><label className="label">Longitude</label><input type="number" step="any" value={form.longitude} onChange={(e) => set('longitude', e.target.value)} className="input-field bg-gray-50" placeholder="Set by clicking map" readOnly /></div>
              </div>

              <div><label className="label">Notes</label><textarea value={form.notes} onChange={(e) => set('notes', e.target.value)} rows={3} className="input-field" placeholder="Additional details about the incident…" /></div>
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
