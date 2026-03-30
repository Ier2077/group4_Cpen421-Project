import { useEffect, useState, useRef, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import { incidentApi } from '../api/incidents';
import { vehicleApi } from '../api/vehicles';
import PageHeader from '../components/PageHeader';
import StatusBadge from '../components/StatusBadge';
import LoadingSpinner from '../components/LoadingSpinner';
import { Wifi, WifiOff, Play, Square, RotateCcw } from 'lucide-react';
import type { Incident, Vehicle } from '../types';

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const SHADOW = 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png';
const mkIcon = (color: string) =>
  new L.Icon({
    iconUrl: `https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-${color}.png`,
    shadowUrl: SHADOW, iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34],
  });

const incidentIcon = mkIcon('red');
const vehicleIcon = mkIcon('blue');       // ambulance idle
const fireIdleIcon = mkIcon('orange');    // fire idle
const policeIdleIcon = mkIcon('grey');    // police idle
const vehicleActiveIcon = mkIcon('green');
const hospitalIcon = mkIcon('violet');

const getIdleVehicleIcon = (serviceType: string) => {
  if (serviceType === 'fire') return fireIdleIcon;
  if (serviceType === 'police') return policeIdleIcon;
  return vehicleIcon; // blue for ambulance
};

const HOSPITALS = [
  { name: 'Korle Bu Teaching Hospital', lat: 5.5390, lng: -0.2274 },
  { name: 'Ridge Hospital', lat: 5.5717, lng: -0.1887 },
  { name: '37 Military Hospital', lat: 5.6037, lng: -0.1870 },
  { name: 'Tema General Hospital', lat: 5.6698, lng: -0.0166 },
  { name: 'Komfo Anokye Teaching Hosp', lat: 6.6885, lng: -1.6244 },
  { name: 'Cape Coast Teaching Hosp', lat: 5.1053, lng: -1.2466 },
];

function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function nearestHospital(lat: number, lng: number) {
  let best = HOSPITALS[0]; let bestDist = Infinity;
  for (const h of HOSPITALS) { const d = haversine(lat, lng, h.lat, h.lng); if (d < bestDist) { bestDist = d; best = h; } }
  return best;
}

async function getRoute(from: [number, number], to: [number, number]): Promise<[number, number][]> {
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${from[1]},${from[0]};${to[1]},${to[0]}?overview=full&geometries=geojson`;
    const res = await fetch(url);
    const data = await res.json();
    if (data.routes?.[0]) return data.routes[0].geometry.coordinates.map((c: number[]) => [c[1], c[0]] as [number, number]);
  } catch (e) { console.warn('OSRM failed, using straight line', e); }
  const steps = 40; const pts: [number, number][] = [];
  for (let i = 0; i <= steps; i++) { const t = i / steps; pts.push([from[0] + (to[0] - from[0]) * t, from[1] + (to[1] - from[1]) * t]); }
  return pts;
}

function samplePath(path: [number, number][], max: number): [number, number][] {
  if (path.length <= max) return path;
  const s: [number, number][] = []; const step = (path.length - 1) / (max - 1);
  for (let i = 0; i < max - 1; i++) s.push(path[Math.round(i * step)]);
  s.push(path[path.length - 1]); return s;
}

function FitBounds({ pts }: { pts: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (pts.length > 1) map.fitBounds(L.latLngBounds(pts.map(([a, b]) => L.latLng(a, b))), { padding: [50, 50], maxZoom: 14 });
    else if (pts.length === 1) map.setView(pts[0], 14);
  }, [pts, map]);
  return null;
}

type SimPhase = 'to_incident' | 'to_hospital' | 'done';

interface SimState {
  incidentId: string; vehicleId: string; phase: SimPhase;
  pathToIncident: [number, number][]; pathToHospital: [number, number][];
  hospitalName: string | null; currentPath: [number, number][];
  currentStep: number; running: boolean; totalSteps: number; isMedical: boolean;
}

export default function TrackingPage() {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [wsOn, setWsOn] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sim, setSim] = useState<SimState | null>(null);
  const [simLoading, setSimLoading] = useState(false);
  const simTimer = useRef<ReturnType<typeof setInterval>>();

  const loadData = useCallback(async () => {
    try { const [inc, veh] = await Promise.all([incidentApi.getOpen(), vehicleApi.getAll()]); setIncidents(inc); setVehicles(veh); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // WebSocket
  useEffect(() => {
    if (!selected) return;
    const base = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000').replace('http', 'ws');
    const ws = new WebSocket(`${base}/vehicles/ws/incident/${selected}`);
    ws.onopen = () => setWsOn(true); ws.onclose = () => setWsOn(false); ws.onerror = () => setWsOn(false);
    ws.onmessage = (e) => { try { const d = JSON.parse(e.data); if (d.vehicle_id && d.latitude != null) setVehicles((p) => p.map((v) => v.id === d.vehicle_id ? { ...v, latitude: d.latitude, longitude: d.longitude } : v)); } catch {} };
    return () => { ws.close(); setWsOn(false); };
  }, [selected]);

  // Tick
  useEffect(() => {
    if (!sim?.running) return;
    simTimer.current = setInterval(() => {
      setSim((prev) => {
        if (!prev?.running) return prev;
        const next = prev.currentStep + 1;
        if (next >= prev.currentPath.length) {
          if (prev.phase === 'to_incident' && prev.isMedical && prev.pathToHospital.length > 0)
            return { ...prev, phase: 'to_hospital', currentPath: prev.pathToHospital, currentStep: 0, running: true };
          return { ...prev, currentStep: prev.currentPath.length - 1, running: false, phase: 'done' };
        }
        return { ...prev, currentStep: next };
      });
    }, 200);
    return () => clearInterval(simTimer.current);
  }, [sim?.running, sim?.phase]);

  // Backend updates
  useEffect(() => {
    if (!sim || sim.currentStep === 0) return;
    const pos = sim.currentPath[sim.currentStep];
    if (!pos) return;
    setVehicles((p) => p.map((v) => v.id === sim.vehicleId ? { ...v, latitude: pos[0], longitude: pos[1] } : v));
    vehicleApi.updateLocation(sim.vehicleId, pos[0], pos[1]).catch(() => {});
    if (sim.phase === 'to_incident' && sim.currentStep === sim.currentPath.length - 1)
      incidentApi.updateStatus(sim.incidentId, 'IN_PROGRESS').catch(() => {});
    if (sim.phase === 'done' || (sim.phase === 'to_hospital' && sim.currentStep === sim.currentPath.length - 1)) {
      incidentApi.updateStatus(sim.incidentId, 'RESOLVED').catch(() => {});
      setTimeout(loadData, 1000);
    }
  }, [sim?.currentStep, sim?.phase]);

  const startSimulation = async (incident: Incident) => {
    if (!incident.assigned_vehicle_id) return;
    const vehicle = vehicles.find((v) => v.id === incident.assigned_vehicle_id);
    if (!vehicle) return;
    setSimLoading(true); setSelected(incident.id);

    const from: [number, number] = [vehicle.latitude, vehicle.longitude];
    const to: [number, number] = [incident.latitude, incident.longitude];
    const pathToIncident = samplePath(await getRoute(from, to), 60);

    const isMedical = ['medical', 'accident'].includes(incident.incident_type);
    let pathToHospital: [number, number][] = []; let hospitalName: string | null = null;
    if (isMedical) {
      const h = incident.assigned_hospital_name ? (HOSPITALS.find((x) => x.name.includes(incident.assigned_hospital_name!)) || nearestHospital(to[0], to[1])) : nearestHospital(to[0], to[1]);
      hospitalName = h.name;
      pathToHospital = samplePath(await getRoute(to, [h.lat, h.lng]), 60);
    }

    setSim({ incidentId: incident.id, vehicleId: vehicle.id, phase: 'to_incident', pathToIncident, pathToHospital, hospitalName, currentPath: pathToIncident, currentStep: 0, running: true, totalSteps: pathToIncident.length + pathToHospital.length, isMedical });
    setSimLoading(false);
  };

  const stopSim = () => { clearInterval(simTimer.current); setSim((p) => p ? { ...p, running: false } : null); };
  const resumeSim = () => setSim((p) => p ? { ...p, running: true } : null);
  const resetSim = () => { clearInterval(simTimer.current); setSim(null); loadData(); };

  if (loading) return <LoadingSpinner />;

  const activeIncidents = incidents.filter((i) => i.status === 'DISPATCHED' || i.status === 'IN_PROGRESS');
  const createdIncidents = incidents.filter((i) => i.status === 'CREATED');
  const simPos = sim ? sim.currentPath[sim.currentStep] : null;
  const simTrail = sim ? sim.currentPath.slice(0, sim.currentStep + 1) : [];
  const fullRoute = sim ? (sim.phase === 'to_incident' ? sim.currentPath : sim.pathToIncident.concat(sim.currentPath)) : [];
  const overallProgress = sim ? (sim.phase === 'to_incident' ? (sim.currentStep / sim.totalSteps) * 100 : sim.phase === 'to_hospital' ? ((sim.pathToIncident.length + sim.currentStep) / sim.totalSteps) * 100 : 100) : 0;
  const phaseLabel = sim ? (sim.phase === 'to_incident' ? 'En route to incident' : sim.phase === 'to_hospital' ? `Transporting to ${sim.hospitalName}` : 'Complete — incident resolved') : '';

  const pts: [number, number][] = [...incidents.map((i) => [i.latitude, i.longitude] as [number, number]), ...vehicles.filter((v) => !v.is_available || v.incident_id).map((v) => [v.latitude, v.longitude] as [number, number])];
  if (pts.length === 0) pts.push([5.56, -0.2]);

  return (
    <div>
      <PageHeader title="Live Tracking" description="Real-time incident and responder tracking">
        <div className="flex items-center gap-2">
          {sim && (<>
            {sim.running ? <button onClick={stopSim} className="btn-secondary text-xs"><Square className="h-3 w-3" /> Pause</button>
            : sim.phase !== 'done' ? <button onClick={resumeSim} className="btn-primary text-xs"><Play className="h-3 w-3" /> Resume</button> : null}
            <button onClick={resetSim} className="btn-secondary text-xs"><RotateCcw className="h-3 w-3" /> Reset</button>
            {sim.phase === 'done' && <span className="badge bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200">Resolved</span>}
          </>)}
          {wsOn ? <span className="badge bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 flex items-center gap-1.5"><Wifi className="h-3 w-3" /> Live</span>
          : <span className="badge bg-gray-100 text-gray-500 ring-1 ring-gray-200 flex items-center gap-1.5"><WifiOff className="h-3 w-3" /> {selected ? 'Disconnected' : 'Select incident'}</span>}
        </div>
      </PageHeader>

      <div className="grid lg:grid-cols-[320px_1fr] gap-5">
        <div className="space-y-4">
          <div className="card">
            <h3 className="text-sm font-medium text-gray-900 mb-3">Dispatched Incidents</h3>
            {activeIncidents.length === 0 ? <p className="text-sm text-gray-400">No dispatched incidents</p> : (
              <div className="space-y-2">{activeIncidents.map((inc) => {
                const veh = vehicles.find((v) => v.id === inc.assigned_vehicle_id);
                const isSimming = sim?.incidentId === inc.id;
                return (<div key={inc.id} className={`rounded-md border px-3 py-2.5 transition-colors ${selected === inc.id ? 'border-brand-300 bg-brand-50' : 'border-gray-200 hover:bg-gray-50'}`}>
                  <button onClick={() => setSelected(inc.id)} className="w-full text-left">
                    <div className="flex items-center justify-between mb-1"><StatusBadge status={inc.incident_type} /><StatusBadge status={inc.status} /></div>
                    <p className="text-sm font-medium text-gray-900">{inc.citizen_name}</p>
                    <p className="text-xs text-gray-400">{inc.region || 'Unknown'}</p>
                    {veh && <p className="text-xs text-gray-500 mt-1">🚗 {veh.plate_number} — {veh.assigned_personnel_name || 'Unassigned'}</p>}
                  </button>
                  {inc.assigned_vehicle_id && !isSimming && <button onClick={() => startSimulation(inc)} disabled={simLoading} className="btn-primary text-xs mt-2 w-full"><Play className="h-3 w-3" /> {simLoading ? 'Loading route…' : 'Simulate Response'}</button>}
                  {isSimming && sim && (<div className="mt-2">
                    <div className="w-full bg-gray-200 rounded-full h-1.5"><div className="bg-brand-600 h-1.5 rounded-full transition-all duration-200" style={{ width: `${overallProgress}%` }} /></div>
                    <p className="text-[10px] text-gray-500 mt-1">{phaseLabel} — {Math.round(overallProgress)}%</p>
                  </div>)}
                </div>);
              })}</div>
            )}
          </div>

          {createdIncidents.length > 0 && (<div className="card">
            <h3 className="text-sm font-medium text-gray-900 mb-3">Awaiting Dispatch</h3>
            <div className="space-y-2">{createdIncidents.map((inc) => (
              <div key={inc.id} className="rounded-md border border-amber-200 bg-amber-50/50 px-3 py-2.5">
                <div className="flex items-center justify-between mb-1"><StatusBadge status={inc.incident_type} /><StatusBadge status={inc.status} /></div>
                <p className="text-sm font-medium text-gray-900">{inc.citizen_name}</p>
                <p className="text-xs text-gray-400">Waiting for dispatch</p>
              </div>
            ))}</div>
          </div>)}

          <div className="card">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Legend</p>
            <div className="space-y-1.5 text-xs text-gray-600">
              <div className="flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-red-500 inline-block" /> Incident</div>
              <div className="flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-blue-500 inline-block" /> Ambulance (idle)</div>
              <div className="flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-orange-400 inline-block" /> Fire truck (idle)</div>
              <div className="flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-gray-400 inline-block" /> Police (idle)</div>
              <div className="flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-green-500 inline-block" /> Vehicle (responding)</div>
              <div className="flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-purple-500 inline-block" /> Hospital</div>
              <div className="flex items-center gap-2"><span className="h-1 bg-gray-400 w-5 inline-block rounded" style={{ borderTop: '2px dashed #9ca3af' }} /> Planned route</div>
              <div className="flex items-center gap-2"><span className="h-1 bg-blue-600 w-5 inline-block rounded" /> Traveled path</div>
              <div className="flex items-center gap-2"><span className="h-1 bg-purple-500 w-5 inline-block rounded" style={{ borderTop: '2px dashed #8b5cf6' }} /> Hospital route</div>
            </div>
          </div>
        </div>

        <div className="card p-0 overflow-hidden" style={{ height: 620 }}>
          <MapContainer center={[5.56, -0.2]} zoom={12} style={{ height: '100%', width: '100%' }} scrollWheelZoom>
            <TileLayer attribution="&copy; OpenStreetMap" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            <FitBounds pts={pts} />

            {HOSPITALS.filter((h) => h.lat > 5 && h.lat < 7).map((h) => (
              <Marker key={h.name} position={[h.lat, h.lng]} icon={hospitalIcon}>
                <Popup><div className="text-sm"><p className="font-semibold">🏥 {h.name}</p></div></Popup>
              </Marker>
            ))}

            {incidents.map((i) => (
              <Marker key={`inc-${i.id}`} position={[i.latitude, i.longitude]} icon={incidentIcon}>
                <Popup><div className="text-sm min-w-[160px]"><p className="font-semibold">{i.citizen_name}</p><p className="text-gray-500 capitalize">{i.incident_type} — {i.status.replace(/_/g, ' ')}</p>{i.assigned_hospital_name && <p className="text-purple-600 text-xs mt-1">🏥 {i.assigned_hospital_name}</p>}</div></Popup>
              </Marker>
            ))}

            {vehicles.map((v) => {
              const isSimVeh = sim?.vehicleId === v.id;
              const pos: [number, number] = isSimVeh && simPos ? simPos : [v.latitude, v.longitude];
              return (<Marker key={`veh-${v.id}`} position={pos} icon={isSimVeh || v.incident_id ? vehicleActiveIcon : getIdleVehicleIcon(v.service_type)}>
                <Popup><div className="text-sm min-w-[160px]"><p className="font-semibold">{v.plate_number}</p><p className="text-gray-500 capitalize">{v.service_type} — {v.vehicle_status.replace(/_/g, ' ')}</p><p className="text-gray-400 text-xs">{v.assigned_personnel_name || 'Unassigned'}</p></div></Popup>
              </Marker>);
            })}

            {fullRoute.length > 1 && <Polyline positions={fullRoute} pathOptions={{ color: '#9ca3af', weight: 3, dashArray: '6 8', opacity: 0.5 }} />}
            {sim?.isMedical && sim.pathToHospital.length > 1 && sim.phase === 'to_incident' && <Polyline positions={sim.pathToHospital} pathOptions={{ color: '#8b5cf6', weight: 3, dashArray: '6 8', opacity: 0.4 }} />}
            {simTrail.length > 1 && <Polyline positions={simTrail} pathOptions={{ color: '#2563eb', weight: 4, opacity: 0.8 }} />}
          </MapContainer>
        </div>
      </div>
    </div>
  );
}