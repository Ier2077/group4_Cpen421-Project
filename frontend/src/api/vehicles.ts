import api from './client';
import type { Vehicle } from '../types';

export const vehicleApi = {
  getAll: async (serviceType?: string): Promise<Vehicle[]> => {
    const params = serviceType ? { service_type: serviceType } : {};
    const res = await api.get('/vehicles', { params });
    return res.data;
  },
  getById: async (id: string): Promise<Vehicle> => {
    const res = await api.get(`/vehicles/${id}`);
    return res.data;
  },
  updateLocation: async (id: string, lat: number, lng: number): Promise<Vehicle> => {
    const res = await api.post(`/vehicles/${id}/location`, { latitude: lat, longitude: lng });
    return res.data;
  },
  updateStatus: async (id: string, vehicle_status: string, is_available?: boolean): Promise<Vehicle> => {
    const res = await api.put(`/vehicles/${id}/status`, { vehicle_status, is_available });
    return res.data;
  },
};
