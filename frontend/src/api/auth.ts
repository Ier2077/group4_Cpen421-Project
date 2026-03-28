import api from './client';
import type { LoginRequest, TokenResponse, User } from '../types';

export const authApi = {
  login: async (data: LoginRequest): Promise<TokenResponse> => {
    const res = await api.post('/auth/login', data);
    return res.data;
  },
  getProfile: async (): Promise<User> => {
    const res = await api.get('/auth/profile');
    return res.data;
  },
};
