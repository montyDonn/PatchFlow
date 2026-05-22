import api from './client';
import type { Module } from './modules';

export interface User {
  id: string;
  userId: string;
  username: string;
  name: string;
  role: string;
  designation?: string;
  isActive?: boolean;
  modules?: Module[];
}

export interface CreateUserPayload {
  username: string;
  password: string;
  name: string;
  role: string;
  designation?: string;
}

export interface UpdateUserPayload {
  username?: string;
  name?: string;
  password?: string;
  designation?: string;
}

export const getUsers = async (role?: string, includeModules = false): Promise<User[]> => {
  const params = new URLSearchParams();
  if (role) params.set('role', role);
  if (includeModules) params.set('includeModules', 'true');
  const query = params.toString();
  const res = await api.get(`/users${query ? `?${query}` : ''}`);
  return res.data;
};

export const getAllUsers = async (): Promise<User[]> => {
  const res = await api.get('/users?includeInactive=true');
  return res.data;
};

export const createUser = async (payload: CreateUserPayload): Promise<User> => {
  const res = await api.post('/users', payload);
  return res.data;
};

export const updateUser = async (userId: string, payload: UpdateUserPayload): Promise<User> => {
  const res = await api.patch(`/users/${userId}`, payload);
  return res.data;
};

export const deleteUser = async (userId: string): Promise<void> => {
  await api.delete(`/users/${userId}`);
};

export const reactivateUser = async (userId: string): Promise<void> => {
  await api.patch(`/users/${userId}/reactivate`, {});
};

export const resetPassword = async (userId: string): Promise<{ tempPassword: string }> => {
  const res = await api.post(`/users/${userId}/reset-password`, {});
  return res.data;
};

export const updateUserModules = async (userId: string, moduleIds: string[]): Promise<any> => {
  const res = await api.put(`/users/${userId}/modules`, { moduleIds });
  return res.data;
};

export const updateUserManagers = async (userId: string, managerIds: string[]): Promise<any> => {
  const res = await api.put(`/users/${userId}/managers`, { managerIds });
  return res.data;
};
