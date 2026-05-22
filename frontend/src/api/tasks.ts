import api from './client';

export interface TaskUser {
  id?: string;
  userId?: string;
  username?: string;
  name?: string;
  email?: string;
  role?: string;
  firstName?: string;
  lastName?: string;
  modules?: Module[];
}
export interface Module { id: string; name: string; }
export interface Team   { id: string; name: string; }

export interface StatusHistoryEntry {
  id: string;
  previousStatus: string;
  newStatus: string;
  reason?: string;
  createdAt: string;
  changedById?: string;
  changedByName?: string;
  changedByUsername?: string;
  changedByRole?: string;
  actor?: TaskUser;
}

export interface TaskComment {
  id: string;
  content: string;
  createdAt: string;
  user: TaskUser;
  authorName?: string;
  authorRole?: string;
  files?: any[];
}

export interface Task {
  id: string;
  title: string;
  description: string;
  status: string;
  clientRequestId?: number;
  authorId: string;
  assigneeId?: string;
  approverId?: string;
  deployerId?: string;
  verifierId?: string;
  clientId?: string;
  managerId?: string;
  dateGiven?: string;
  dateStarted?: string;
  dateEnded?: string;
  teamId?: string;
  moduleId?: string;
  assignedAt?: string;
  lifecycleStatus?: number;
  plannedStartDate?: string;
  plannedEndDate?: string;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
  author: TaskUser;
  client?: TaskUser;
  manager?: TaskUser;
  managers?: TaskUser[];
  developers?: TaskUser[];
  verifiers?: TaskUser[];
  assignee?: TaskUser;
  approver?: TaskUser;
  deployer?: TaskUser;
  verifier?: TaskUser;
  team?: Team;
  module?: Module;
  statusHistory?: StatusHistoryEntry[];
  auditLogs?: any[];
  comments?: TaskComment[];
  attachments?: any[];
}

export const getTasks = async (includeDeleted = false): Promise<Task[]> => {
  const res = await api.get(`/tasks${includeDeleted ? '?includeDeleted=true' : ''}`);
  return res.data;
};

export const getTaskById = async (id: string): Promise<Task> => {
  const res = await api.get(`/tasks/${id}`);
  return res.data;
};

export const createTask = async (data: {
  title: string;
  description: string;
  moduleId: string;
  teamId?: string;
  clientId?: string;
  clientRequestId?: number;
  managerIds?: string[];
  developerIds?: string[];
  verifierIds?: string[];
  dateGiven?: string;
  assigneeId?: string;
  approverId?: string;
  deployerId?: string;
  verifierId?: string;
  lifecycleStatus: number;
  plannedStartDate?: string;
  plannedEndDate?: string;
}): Promise<Task> => {
  const taskRes = await api.post('/tasks', data);
  return taskRes.data;
};

export const updateTaskStatus = async (id: string, status: string, reason?: string): Promise<Task> => {
  const res = await api.patch(`/tasks/${id}/status`, { status, reason });
  return res.data;
};

export const addTaskComment = async (id: string, content: string, files?: any[]): Promise<Task> => {
  const res = await api.post(`/tasks/${id}/comments`, { content, files });
  return res.data;
};

export const softDeleteTask = async (id: string): Promise<Task> => {
  const res = await api.delete(`/tasks/${id}`);
  return res.data;
};

export const restoreTask = async (id: string): Promise<Task> => {
  const res = await api.post(`/tasks/${id}/restore`);
  return res.data;
};

export const assignTask = async (id: string, assigneeId: string): Promise<Task> => {
  const res = await api.post(`/tasks/${id}/assign`, { assigneeId });
  return res.data;
};

export const updateTaskDetails = async (id: string, data: {
  title?: string;
  description?: string;
  plannedStartDate?: string;
  plannedEndDate?: string;
  clientId?: string;
  clientRequestId?: number;
  managerIds?: string[];
  developerIds?: string[];
  verifierIds?: string[];
  moduleId?: string;
  dateGiven?: string;
  dateStarted?: string;
  dateEnded?: string;
  status?: string;
  reason?: string;
}): Promise<Task> => {
  const res = await api.patch(`/tasks/${id}/details`, data);
  return res.data;
};
