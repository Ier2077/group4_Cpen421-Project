export type UserRole = 'system_admin' | 'hospital_admin' | 'police_admin' | 'fire_admin' | 'ambulance_driver';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  organization_id: string | null;
  created_at: string;
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export type IncidentType = 'medical' | 'fire' | 'crime' | 'robbery' | 'assault' | 'accident' | 'other';
export type IncidentStatus = 'CREATED' | 'DISPATCHED' | 'IN_PROGRESS' | 'RESOLVED';

export interface Incident {
  id: string;
  citizen_name: string;
  citizen_phone: string | null;
  incident_type: IncidentType;
  latitude: number;
  longitude: number;
  notes: string | null;
  region: string | null;
  created_by: string;
  assigned_vehicle_id: string | null;
  assigned_unit_type: string | null;
  assigned_hospital_id: string | null;
  assigned_hospital_name: string | null;
  status: IncidentStatus;
  dispatched_at: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface IncidentCreateRequest {
  citizen_name: string;
  citizen_phone?: string;
  incident_type: IncidentType;
  latitude: number;
  longitude: number;
  notes?: string;
}

export type ServiceType = 'ambulance' | 'police' | 'fire';
export type VehicleStatus = 'available' | 'en_route' | 'on_scene' | 'returning' | 'offline';

export interface Vehicle {
  id: string;
  service_type: ServiceType;
  organization_id: string;
  plate_number: string;
  assigned_personnel_name: string | null;
  incident_id: string | null;
  latitude: number;
  longitude: number;
  vehicle_status: VehicleStatus;
  is_available: boolean;
  updated_at: string;
}

export interface ResponseTimes {
  total_incidents: number;
  avg_response_time_seconds: number;
  avg_resolution_time_seconds: number;
  min_response_time_seconds: number | null;
  max_response_time_seconds: number | null;
}

export interface RegionData {
  region: string;
  incident_type: string;
  count: number;
}

export interface ResourceUtilization {
  top_deployed_vehicles: { vehicle_id: string; unit_type: string; deployments: number }[];
  incidents_by_status: Record<string, number>;
  incidents_by_unit_type: Record<string, number>;
}
