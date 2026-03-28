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

// Fix leaflet default icons
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
    shadowUrl: SHADOW,
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
  });

const incidentIcon = mkIcon('red');
const vehicleIcon = mkIcon('blue');
const vehicleActiveIcon = mkIcon('green');
const hospitalIcon = mkIcon('violet');

// Interpolate between two points
function interpolate(
  from: [number, number],
  to: [number, number],
  steps: number
): [number, number][] {
  const points: [number, number][] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    points.push([from[0] + (to[0] - from[0]) * t, from[1] + (to[1] - from[1]) * t]);
  }
  return points;
}

function FitBounds({ pts }: { pts: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (pts.length > 1) {
      map.fitBounds(
        L.latLngBounds(pts.map(([a, b]) => L.latLng(a, b))),
        { padding: [50, 50], maxZoom: 14 }
      );
    } else if (pts.length === 1) {
      map.setView(pts[0], 14);
    }
  }, [pts, map]);
  return null;
}

interface SimState {
  incidentId: string;
  vehicleId: string;
  path: [number, number][];
  currentStep: number;
  running: boolean;
  arrived: boolean;
}

export default function TrackingPage() {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [wsOn, setWsOn] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sim, setSim] = useState<SimState | null>(null);
  const simTimer = useRef<ReturnType<typeof setInterval>>();
  const wsRef = useRef<WebSocket | null>(null);

  // Load data
  const loadData = useCallback(async () => {
    try {
      const [inc, veh] = await Promise.all([incidentApi.getOpen(), vehicleApi.getAll()]);
      setIncidents(inc);
      setVehicles(veh);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // WebSocket
  useEffect(() => {
    if (!selected) return;
    const base = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000').replace(
      'http',
      'ws'
    );
    const ws = new WebSocket(`${base}/vehicles/ws/incident/${selected}`);
    wsRef.current = ws;
    ws.onopen = () => setWsOn(true);
    ws.onclose = () => setWsOn(false);
    ws.onerror = () => setWsOn(false);
    ws.onmessage = (e) => {
      try {
        const d = JSON.parse(e.data);
        if (d.vehicle_id && d.latitude != null) {
          setVehicles((p) =>
            p.map((v) =>
              v.id === d.vehicle_id ? { ...v, latitude: d.latitude, longitude: d.longitude } : v
            )
          );
        }
      } catch {}
    };
    return () => {
      ws.close();
      setWsOn(false);
    };
  }, [selected]);

  // Simulation tick
  useEffect(() => {
    if (!sim || !sim.running) return;

    simTimer.current = setInterval(async () => {
      setSim((prev) => {
        if (!prev || !prev.running) return prev;
        const next = prev.currentStep + 1;
        if (next >= prev.path.length) {
          // Arrived
          return { ...prev, currentStep: prev.path.length - 1, running: false, arrived: true };
        }
        return { ...prev, currentStep: next };
      });
    }, 300); // move every 300ms

    return () => clearInterval(simTimer.current);
  }, [sim?.running]);

  // Update backend when sim position changes
  useEffect(() => {
    if (!sim || sim.currentStep === 0) return;
    const pos = sim.path[sim.currentStep];
    if (!pos) return;

    // Update vehicle in local state
    setVehicles((prev) =>
      prev.map((v) =>
        v.id === sim.vehicleId ? { ...v, latitude: pos[0], longitude: pos[1] } : v
      )
    );

    // Update backend (fire and forget)
    vehicleApi.updateLocation(sim.vehicleId, pos[0], pos[1]).catch(() => {});

    // If arrived, update incident status
    if (sim.arrived) {
      incidentApi.updateStatus(sim.incidentId, 'IN_PROGRESS').catch(() => {});
      // Refresh data
      setTimeout(loadData, 500);
    }
  }, [sim?.currentStep, sim?.arrived]);

  // Start simulation
  const startSimulation = (incident: Incident) => {
    if (!incident.assigned_vehicle_id) return;
    const vehicle = vehicles.find((v) => v.id === incident.assigned_vehicle_id);
    if (!vehicle) return;

    const from: [number, number] = [vehicle.latitude, vehicle.longitude];
    const to: [number, number] = [incident.latitude, incident.longitude];
    const path = interpolate(from, to, 40); // 40 steps

    setSim({
      incidentId: incident.id,
      vehicleId: vehicle.id,
      path,
      currentStep: 0,
      running: true,
      arrived: false,
    });
    setSelected(incident.id);
  };

  const stopSimulation = () => {
    clearInterval(simTimer.current);
    setSim((prev) => (prev ? { ...prev, running: false } : null));
  };

  const resetSimulation = () => {
    clearInterval(simTimer.current);
    setSim(null);
    loadData();
  };

  if (loading) return <LoadingSpinner />;

  // Dispatched or in-progress incidents
  const activeIncidents = incidents.filter(
    (i) => i.status === 'DISPATCHED' || i.status === 'IN_PROGRESS'
  );
  const allIncidents = incidents;

  // Get current sim vehicle position
  const simPosition = sim ? sim.path[sim.currentStep] : null;
  const simTrail = sim ? sim.path.slice(0, sim.currentStep + 1) : [];

  // Map bounds
  const pts: [number, number][] = [
    ...allIncidents.map((i) => [i.latitude, i.longitude] as [number, number]),
    ...vehicles
      .filter((v) => !v.is_available || v.incident_id)
      .map((v) => [v.latitude, v.longitude] as [number, number]),
  ];
  if (pts.length === 0) pts.push([5.56, -0.2]);

  return (
    <div>
      <PageHeader title="Live Tracking" description="Real-time incident and responder tracking">
        <div className="flex items-center gap-2">
          {sim && (
            <>
              {sim.running ? (
                <button onClick={stopSimulation} className="btn-secondary text-xs">
                  <Square className="h-3 w-3" /> Pause
                </button>
              ) : !sim.arrived ? (
                <button
                  onClick={() => setSim((p) => (p ? { ...p, running: true } : null))}
                  className="btn-primary text-xs"
                >
                  <Play className="h-3 w-3" /> Resume
                </button>
              ) : null}
              <button onClick={resetSimulation} className="btn-secondary text-xs">
                <RotateCcw className="h-3 w-3" /> Reset
              </button>
              {sim.arrived && (
                <span className="badge bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200">
                  Responder arrived!
                </span>
              )}
            </>
          )}
          {wsOn ? (
            <span className="badge bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 flex items-center gap-1.5">
              <Wifi className="h-3 w-3" /> Live
            </span>
          ) : (
            <span className="badge bg-gray-100 text-gray-500 ring-1 ring-gray-200 flex items-center gap-1.5">
              <WifiOff className="h-3 w-3" />{' '}
              {selected ? 'Disconnected' : 'Select incident'}
            </span>
          )}
        </div>
      </PageHeader>

      <div className="grid lg:grid-cols-[320px_1fr] gap-5">
        {/* Sidebar */}
        <div className="space-y-4">
          {/* Active incidents with assigned vehicles */}
          <div className="card">
            <h3 className="text-sm font-medium text-gray-900 mb-3">Dispatched Incidents</h3>
            {activeIncidents.length === 0 ? (
              <p className="text-sm text-gray-400">No dispatched incidents</p>
            ) : (
              <div className="space-y-2">
                {activeIncidents.map((inc) => {
                  const veh = vehicles.find((v) => v.id === inc.assigned_vehicle_id);
                  const isSimming = sim?.incidentId === inc.id;
                  return (
                    <div
                      key={inc.id}
                      className={`rounded-md border px-3 py-2.5 transition-colors ${
                        selected === inc.id
                          ? 'border-brand-300 bg-brand-50'
                          : 'border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      <button
                        onClick={() => setSelected(inc.id)}
                        className="w-full text-left"
                      >
                        <div className="flex items-center justify-between mb-1">
                          <StatusBadge status={inc.incident_type} />
                          <StatusBadge status={inc.status} />
                        </div>
                        <p className="text-sm font-medium text-gray-900">{inc.citizen_name}</p>
                        <p className="text-xs text-gray-400">{inc.region || 'Unknown'}</p>
                        {veh && (
                          <p className="text-xs text-gray-500 mt-1">
                            🚗 {veh.plate_number} — {veh.assigned_personnel_name || 'Unassigned'}
                          </p>
                        )}
                      </button>
                      {inc.assigned_vehicle_id && !isSimming && (
                        <button
                          onClick={() => startSimulation(inc)}
                          className="btn-primary text-xs mt-2 w-full"
                        >
                          <Play className="h-3 w-3" /> Simulate Response
                        </button>
                      )}
                      {isSimming && sim && (
                        <div className="mt-2">
                          <div className="w-full bg-gray-200 rounded-full h-1.5">
                            <div
                              className="bg-brand-600 h-1.5 rounded-full transition-all duration-300"
                              style={{
                                width: `${(sim.currentStep / (sim.path.length - 1)) * 100}%`,
                              }}
                            />
                          </div>
                          <p className="text-[10px] text-gray-400 mt-1">
                            {sim.arrived
                              ? 'Responder on scene'
                              : `En route — ${Math.round(
                                  (sim.currentStep / (sim.path.length - 1)) * 100
                                )}%`}
                          </p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* All incidents (non-dispatched) */}
          {allIncidents.filter((i) => i.status === 'CREATED').length > 0 && (
            <div className="card">
              <h3 className="text-sm font-medium text-gray-900 mb-3">Awaiting Dispatch</h3>
              <div className="space-y-2">
                {allIncidents
                  .filter((i) => i.status === 'CREATED')
                  .map((inc) => (
                    <div
                      key={inc.id}
                      className="rounded-md border border-amber-200 bg-amber-50/50 px-3 py-2.5"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <StatusBadge status={inc.incident_type} />
                        <StatusBadge status={inc.status} />
                      </div>
                      <p className="text-sm font-medium text-gray-900">{inc.citizen_name}</p>
                      <p className="text-xs text-gray-400">
                        No vehicle assigned — waiting for dispatch
                      </p>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Legend */}
          <div className="card">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Legend</p>
            <div className="space-y-1.5 text-xs text-gray-600">
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full bg-red-500 inline-block" /> Incident
                Location
              </div>
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full bg-blue-500 inline-block" /> Vehicle
                (idle)
              </div>
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full bg-green-500 inline-block" /> Vehicle
                (responding)
              </div>
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full bg-purple-500 inline-block" /> Hospital
              </div>
              <div className="flex items-center gap-2">
                <span className="h-2 border-t-2 border-blue-400 w-5 inline-block border-dashed" />{' '}
                Response path
              </div>
            </div>
          </div>
        </div>

        {/* Map */}
        <div className="card p-0 overflow-hidden" style={{ height: 620 }}>
          <MapContainer
            center={[5.56, -0.2]}
            zoom={12}
            style={{ height: '100%', width: '100%' }}
            scrollWheelZoom
          >
            <TileLayer
              attribution="&copy; OpenStreetMap"
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <FitBounds pts={pts} />

            {/* Incident markers (red) */}
            {allIncidents.map((i) => (
              <Marker key={`inc-${i.id}`} position={[i.latitude, i.longitude]} icon={incidentIcon}>
                <Popup>
                  <div className="text-sm min-w-[160px]">
                    <p className="font-semibold">{i.citizen_name}</p>
                    <p className="text-gray-500 capitalize">
                      {i.incident_type} — {i.status.replace(/_/g, ' ')}
                    </p>
                    {i.citizen_phone && <p className="text-gray-400 text-xs">{i.citizen_phone}</p>}
                    {i.assigned_hospital_name && (
                      <p className="text-purple-600 text-xs mt-1">
                        🏥 {i.assigned_hospital_name}
                      </p>
                    )}
                  </div>
                </Popup>
              </Marker>
            ))}

            {/* Vehicle markers */}
            {vehicles.map((v) => {
              // If this vehicle is being simulated, use sim position
              const isSimVehicle = sim?.vehicleId === v.id;
              const pos: [number, number] = isSimVehicle && simPosition
                ? simPosition
                : [v.latitude, v.longitude];
              const icon =
                isSimVehicle || v.incident_id ? vehicleActiveIcon : vehicleIcon;

              return (
                <Marker key={`veh-${v.id}`} position={pos} icon={icon}>
                  <Popup>
                    <div className="text-sm min-w-[160px]">
                      <p className="font-semibold">{v.plate_number}</p>
                      <p className="text-gray-500 capitalize">
                        {v.service_type} — {v.vehicle_status.replace(/_/g, ' ')}
                      </p>
                      <p className="text-gray-400 text-xs">
                        {v.assigned_personnel_name || 'Unassigned'}
                      </p>
                      <p className="text-gray-400 text-xs font-mono">
                        {pos[0].toFixed(4)}, {pos[1].toFixed(4)}
                      </p>
                    </div>
                  </Popup>
                </Marker>
              );
            })}

            {/* Simulation trail line */}
            {simTrail.length > 1 && (
              <Polyline
                positions={simTrail}
                pathOptions={{
                  color: '#2563eb',
                  weight: 3,
                  dashArray: '8 6',
                  opacity: 0.7,
                }}
              />
            )}
          </MapContainer>
        </div>
      </div>
    </div>
  );
}