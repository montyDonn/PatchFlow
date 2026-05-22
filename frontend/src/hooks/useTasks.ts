import { useState, useEffect, useMemo } from 'react';
import api from '../api/client';
import { addTaskComment, restoreTask, softDeleteTask } from '../api/tasks';
import type { Task, Module, TaskUser } from '../api/tasks';

function normalizeUser(user: any): TaskUser | null {
  if (!user) return null;
  return {
    ...user,
    id: user.id || user.userId,
  };
}

function normalizeModule(module: any): Module {
  return {
    id: module.id || module.moduleId,
    name: module.name || module.moduleName,
  };
}

function normalizeComment(comment: any) {
  if (!comment) return comment;
  return {
    ...comment,
    user: normalizeUser(comment.user),
  };
}

function normalizeTask(task: any): Task {
  return {
    ...task,
    author: normalizeUser(task.author),
    assignee: normalizeUser(task.assignee),
    approver: normalizeUser(task.approver),
    deployer: normalizeUser(task.deployer),
    verifier: normalizeUser(task.verifier),
    module: task.module ? normalizeModule(task.module) : undefined,
    team: task.team ? { id: task.team.id, name: task.team.name } : undefined,
    comments: task.comments?.map(normalizeComment),
    statusHistory: task.statusHistory?.map((h: any) => ({
      ...h,
      actor: normalizeUser(h.actor),
    })),
    auditLogs: task.auditLogs?.map((l: any) => ({
      ...l,
      actor: normalizeUser(l.actor),
    })),
  };
}

export function useTasks() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [modules, setModules] = useState<Module[]>([]);
  const [users, setUsers] = useState<TaskUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [selectedModule, setSelectedModule] = useState('');
  const [selectedAssignee, setSelectedAssignee] = useState('');
  const [includeDeleted, setIncludeDeleted] = useState(false);

  const fetchAll = async (showDeleted = includeDeleted) => {
    setLoading(true);
    try {
      const [tRes, mRes, uRes] = await Promise.all([
        api.get(`/tasks${showDeleted ? '?includeDeleted=true' : ''}`),
        api.get('/modules'),
        api.get('/users'),
      ]);

      setTasks((tRes.data || []).map(normalizeTask));
      setModules((mRes.data || []).map(normalizeModule));
      setUsers((uRes.data || []).map((user: any) => normalizeUser(user) as TaskUser));
      setError(null);
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to load board data');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll(includeDeleted);
  }, [includeDeleted]);

  const updateTaskStatus = async (taskId: string, newStatus: string, reason?: string) => {
    try {
      await api.patch(`/tasks/${taskId}/status`, { status: newStatus, reason: reason || 'Updated via Patch Board Kanban' });
      await fetchAll();
    } catch (err) {
      console.error('Failed to update task status', err);
      alert('Failed to update task status');
    }
  };

  const addComment = async (taskId: string, content: string, files?: any[]) => {
    const task = await addTaskComment(taskId, content, files);
    await fetchAll();
    return normalizeTask(task);
  };

  const deleteTask = async (taskId: string) => {
    const task = await softDeleteTask(taskId);
    await fetchAll();
    return normalizeTask(task);
  };

  const restoreDeletedTask = async (taskId: string) => {
    const task = await restoreTask(taskId);
    await fetchAll();
    return normalizeTask(task);
  };

  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      const matchSearch = t.title.toLowerCase().includes(search.toLowerCase()) ||
                          (t.description || '').toLowerCase().includes(search.toLowerCase());
      const matchModule = selectedModule ? t.module?.id === selectedModule : true;
      const matchAssignee = selectedAssignee ? t.assignee?.id === selectedAssignee : true;
      return matchSearch && matchModule && matchAssignee;
    });
  }, [tasks, search, selectedModule, selectedAssignee]);

  return {
    tasks: filteredTasks,
    allTasks: tasks,
    modules,
    users,
    loading,
    error,
    search,
    setSearch,
    selectedModule,
    setSelectedModule,
    selectedAssignee,
    setSelectedAssignee,
    includeDeleted,
    setIncludeDeleted,
    updateTaskStatus,
    addComment,
    deleteTask,
    restoreDeletedTask,
    refresh: fetchAll,
  };
}
