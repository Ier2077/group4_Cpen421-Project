import { useEffect, useState, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { incidentApi } from '../api/incidents';
import { vehicleApi } from '../api/vehicles';
import PageHeader from '../components/PageHeader';
import StatusBadge from '../components/StatusBadge';
import LoadingSpinner from '../components/LoadingSpinner';
import { Wifi, WifiOff } from 'lucide-react';
import type { Incident, Vehicle } from '../types';

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const SHADOW = 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png';
const mkIcon = (color: string) => new L.Icon({
  iconUrl: `https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-${color}.png`,
  shadowUrl: SHADOW, iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34],
});
const incidentIcon = mkIcon('red');
const vehicleIcon = mkIcon('blue');

function FitBounds({ pts }: { pts: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (pts.length) map.fitBounds(L.latLngBounds(pts.map(([a, b]) => L.latLng(a, b))), { padding: [40, 40], maxZoom: 14 });
  }, [pts, map]);
  return null;
}

export default function TrackingPage() {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [wsOn, setWsOn] = useState(false);
  const [loading, setLoading] = useState(true);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    Promise.all([incidentApi.getOpen(), vehicleApi.getAll()])
      .then(([i, v]) => { setIncidents(i); setVehicles(v); })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selected) return;
    const base = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000').replace('http', 'ws');
    const ws = new WebSocket(`${base}/vehicles/ws/incident/${selected}`);
    wsRef.current = ws;
    ws.onopen = () => setWsOn(true);
    ws.onclose = () => setWsOn(false);
    ws.onerror = () => setWsOn(false);
    ws.onmessage = (e) => {
      try {
        const d = JSON.parse(e.data);
        if (d.vehicle_id && d.latitude != null) {
          setVehicles((p) => p.map((v) => v.id === d.vehicle_id ? { ...v, latitude: d.latitude, longitude: d.longitude } : v));
        }
      } catch {}
    };
    return () => { ws.close(); setWsOn(false); };
  }, [selected]);

  if (loading) return <LoadingSpinner />;

  const active = incidents.filter((i) => i.assigned_vehicle_id);
  const deployed = vehicles.filter((v) => !v.is_available);
  const pts: [number, number][] = [
    ...incidents.map((i) => [i.latitude, i.longitude] as [number, number]),
    ...deployed.map((v) => [v.latitude, v.longitude] as [number, number]),
  ];
  const center: [number, number] = pts.length ? pts[0] : [5.56, -0.20];

  return (
    <div>
      <PageHeader title="Live Tracking" description="Real-time incident and responder tracking">
        {wsOn
          ? <span className="badge bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 flex items-center gap-1.5"><Wifi className="h-3 w-3" /> Connected</span>
          : <span className="badge bg-gray-100 text-gray-500 ring-1 ring-gray-200 flex items-center gap-1.5"><WifiOff className="h-3 w-3" /> {selected ? 'Disconnected' : 'Select incident'}</span>
        }
      </PageHeader>

      <div className="grid lg:grid-cols-[300px_1fr] gap-5">
        <div className="card h-fit">
          <h3 className="text-sm font-medium text-gray-900 mb-3">Active Incidents</h3>
          {active.length === 0 ? <p className="text-sm text-gray-400">No dispatched incidents</p> : (
            <div className="space-y-2">
              {active.map((inc) => (
                <button key={inc.id} onClick={() => setSelected(inc.id)}
                  className={`w-full text-left rounded-md border px-3 py-2.5 transition-colors ${selected === inc.id ? 'border-brand-300 bg-brand-50' : 'border-gray-200 hover:bg-gray-50'}`}>
                  <div className="flex items-center justify-between mb-1"><StatusBadge status={inc.incident_type} /><StatusBadge status={inc.status} /></div>
                  <p className="text-sm font-medium text-gray-900">{inc.citizen_name}</p>
                  <p className="text-xs text-gray-400">{inc.region || 'Unknown'}</p>
                </button>
              ))}
            </div>
          )}
          <div className="mt-4 pt-4 border-t border-gray-100">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Legend</p>
            <div className="space-y-1.5 text-xs text-gray-600">
              <div className="flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-red-500 inline-block" /> Incident</div>
              <div className="flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-blue-500 inline-block" /> Responder</div>
            </div>
          </div>
        </div>

        <div className="card p-0 overflow-hidden" style={{ height: 560 }}>
          <MapContainer center={center} zoom={12} style={{ height: '100%', width: '100%' }} scrollWheelZoom>
            <TileLayer attribution='&copy; OpenStreetMap' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            {pts.length > 0 && <FitBounds pts={pts} />}
            {incidents.map((i) => (
              <Marker key={`i-${i.id}`} position={[i.latitude, i.longitude]} icon={incidentIcon}>
                <Popup><div className="text-sm"><p className="font-medium">{i.citizen_name}</p><p className="text-gray-500 capitalize">{i.incident_type} — {i.status}</p></div></Popup>
              </Marker>
            ))}
            {deployed.map((v) => (
              <Marker key={`v-${v.id}`} position={[v.latitude, v.longitude]} icon={vehicleIcon}>
                <Popup><div className="text-sm"><p className="font-medium">{v.plate_number}</p><p className="text-gray-500 capitalize">{v.service_type} — {v.vehicle_status.replace(/_/g, ' ')}</p></div></Popup>
              </Marker>
            ))}
          </MapContainer>
        </div>
      </div>
    </div>
  );
}
