import api from './client';
import type { ResponseTimes, RegionData, ResourceUtilization } from '../types';

export const analyticsApi = {
  getResponseTimes: async (): Promise<ResponseTimes> => {
    const res = await api.get('/analytics/response-times');
    return res.data;
  },
  getByRegion: async (): Promise<RegionData[]> => {
    const res = await api.get('/analytics/incidents-by-region');
    return res.data;
  },
  getResourceUtilization: async (): Promise<ResourceUtilization> => {
    const res = await api.get('/analytics/resource-utilization');
    return res.data;
  },
};