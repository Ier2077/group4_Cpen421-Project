import api from './client';
import type { Incident, IncidentCreateRequest, Hospital } from '../types';

export const incidentApi = {
  create: async (data: IncidentCreateRequest): Promise<Incident> => {
    const res = await api.post('/incidents', data);
    return res.data;
  },
  getOpen: async (): Promise<Incident[]> => {
    const res = await api.get('/incidents/open');
    return res.data;
  },
  getById: async (id: string): Promise<Incident> => {
    const res = await api.get(`/incidents/${id}`);
    return res.data;
  },
  updateStatus: async (id: string, status: string): Promise<Incident> => {
    const res = await api.put(`/incidents/${id}/status`, { status });
    return res.data;
  },
  getHospitals: async (): Promise<Hospital[]> => {
    const res = await api.get('/incidents/hospitals');
    return res.data;
  },
};