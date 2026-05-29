import api from './client';

export interface AccountRequest {
  id: string;
  username: string;
  name: string;
  phone?: string;
  role: 'CLIENT' | 'VIEWER';
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  reviewedBy?: string;
  reviewNote?: string;
  createdAt: string;
  reviewedAt?: string;
}

export interface SubmitRequestPayload {
  username: string;
  password: string;
  name: string;
  phone?: string;
  role: 'CLIENT' | 'VIEWER';
}

/** Public — no auth token needed */
export const submitAccessRequest = async (
  payload: SubmitRequestPayload
): Promise<{ success: boolean; message: string }> => {
  const res = await api.post('/auth/request-access', payload);
  return res.data;
};

/** Admin only */
export const getAccountRequests = async (
  status?: 'PENDING' | 'APPROVED' | 'REJECTED'
): Promise<AccountRequest[]> => {
  const query = status ? `?status=${status}` : '';
  const res = await api.get(`/admin/account-requests${query}`);
  return res.data;
};

/** Admin only — approve and create real user */
export const approveAccountRequest = async (
  id: string
): Promise<{ success: boolean; message: string }> => {
  const res = await api.post(`/admin/account-requests/${id}/approve`);
  return res.data;
};

/** Admin only — reject with optional note */
export const rejectAccountRequest = async (
  id: string,
  note?: string
): Promise<{ success: boolean; message: string }> => {
  const res = await api.post(`/admin/account-requests/${id}/reject`, { note });
  return res.data;
};
