import api from './client';

export interface Module {
  id: string;
  name: string;
  description?: string;
  isActive?: boolean;
  projectId?: string;
  assignedCount?: number;
  users?: ModuleAssignment[];
}

export interface ModuleAssignment {
  id: string;
  assignedAt: string;
  user: {
    id: string;
    username: string;
    name: string;
    role: string;
  };
}

export interface ModuleHierarchy {
  id: string;
  name: string;
  description: string;
  isActive: boolean;
  counts: {
    managers: number;
    resources: number;
    deployers: number;
    verifiers: number;
    totalAssignments: number;
  };
  managers: ModuleAssignment[];
  resources: ModuleAssignment[];
  deployers: ModuleAssignment[];
  verifiers: ModuleAssignment[];
}

export const getModules = async (includeUsers = false): Promise<Module[]> => {
  const res = await api.get(`/modules${includeUsers ? '?includeUsers=true' : ''}`);
  return res.data;
};

export const createModule = async (payload: { name: string; description?: string }): Promise<Module> => {
  const res = await api.post('/modules', payload);
  return res.data;
};

export const updateModule = async (moduleId: string, payload: { name?: string; description?: string; isActive?: boolean }): Promise<Module> => {
  const res = await api.patch(`/modules/${moduleId}`, payload);
  return res.data;
};

export const getModuleHierarchy = async (): Promise<ModuleHierarchy[]> => {
  const res = await api.get('/modules/hierarchy');
  return res.data;
};

export const deleteModule = async (moduleId: string): Promise<void> => {
  await api.delete(`/modules/${moduleId}`);
};
