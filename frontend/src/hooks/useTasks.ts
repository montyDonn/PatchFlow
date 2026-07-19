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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [selectedModule, setSelectedModule] = useState('');
  const [selectedAssignee, setSelectedAssignee] = useState('');
  const [includeDeleted, setIncludeDeleted] = useState(false);

  // FIX 1: Only fetch tasks + modules (removed /users — saves one full API call every load)
  const fetchAll = async (showDeleted = includeDeleted) => {
    setLoading(true);
    try {
      const [tRes, mRes] = await Promise.all([
        api.get(`/tasks${showDeleted ? '?includeDeleted=true' : ''}`),
        api.get('/modules'),
      ]);

      setTasks((tRes.data || []).map(normalizeTask));
      setModules((mRes.data || []).map(normalizeModule));
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
      const res = await api.patch(`/tasks/${taskId}/status`, {
        status: newStatus,
        reason: reason || 'Updated via Change Board',
      });
      const updated = normalizeTask(res.data);
      // Optimistic: replace only the updated task in state (no full refetch)
      setTasks(prev => prev.map(t => t.id === taskId ? updated : t));
    } catch (err) {
      console.error('Failed to update task status', err);
      alert('Failed to update task status');
      throw err;
    }
  };

  // FIX 2: addComment patches local state instead of refetching all 3 APIs
  const addComment = async (taskId: string, content: string, files?: any[]) => {
    const task = await addTaskComment(taskId, content, files);
    const normalised = normalizeTask(task);
    // Patch just this one task in the board list
    setTasks(prev => prev.map(t => t.id === taskId ? normalised : t));
    return normalised;
  };

  const deleteTask = async (taskId: string) => {
    const task = await softDeleteTask(taskId);
    const normalised = normalizeTask(task);
    // Optimistic: update lifecycle status in local state
    setTasks(prev => prev.map(t => t.id === taskId ? normalised : t));
    return normalised;
  };

  const restoreDeletedTask = async (taskId: string) => {
    const task = await restoreTask(taskId);
    const normalised = normalizeTask(task);
    setTasks(prev => prev.map(t => t.id === taskId ? normalised : t));
    return normalised;
  };

  // FIX 1b: Derive unique people from loaded tasks — no separate /users call needed
  const usersFromTasks = useMemo((): TaskUser[] => {
    const seen = new Set<string>();
    const people: TaskUser[] = [];
    tasks.forEach(t => {
      const candidates: (TaskUser | null | undefined)[] = [
        ...(t.managers || []),
        ...(t.developers || []),
        ...(t.verifiers || []),
        ...(t.testers || []),
        ...(t.deployers || []),
        t.manager,
        t.assignee,
        t.client,
        t.deployer,
        t.verifier,
      ];
      candidates.forEach(u => {
        if (!u) return;
        const id = (u as any).id || (u as any).userId;
        if (id && !seen.has(id)) {
          seen.add(id);
          people.push(u as TaskUser);
        }
      });
    });
    return people.sort((a, b) => {
      const na = (a as any).name || (a as any).username || '';
      const nb = (b as any).name || (b as any).username || '';
      return na.localeCompare(nb);
    });
  }, [tasks]);

  const filteredTasks = useMemo(() => {
    const q = search.toLowerCase().trim();
    return tasks.filter((t) => {
      if (!q) {
        const matchModule = selectedModule ? t.module?.id === selectedModule : true;
        const matchAssignee = selectedAssignee
          ? [
              ...(t.managers || []),
              ...(t.developers || []),
              ...(t.verifiers || []),
              t.manager,
              t.assignee,
            ].some((u: any) => u && (u.id || u.userId) === selectedAssignee)
          : true;
        return matchModule && matchAssignee;
      }

      const uName = (u: any) => (u?.name || u?.username || u?.firstName || '').toLowerCase();

      // Extract Change ID from description or fallback to task.id
      const changeIdMatch = (t.description || '').match(/\[CHANGE_ID:\s*([^\]]+)\]/);
      const changeId = (t.id && /^\d{12}$/.test(t.id)) ? t.id.toLowerCase() : (changeIdMatch ? changeIdMatch[1].toLowerCase() : (t.id || '').toLowerCase());

      const matchSearch =
        t.title.toLowerCase().includes(q) ||
        changeId.includes(q) ||
        (t.module?.name || '').toLowerCase().includes(q) ||
        (t.managers || []).some((m: any) => uName(m).includes(q)) ||
        uName(t.manager).includes(q) ||
        (t.developers || []).some((d: any) => uName(d).includes(q)) ||
        (t.verifiers || []).some((v: any) => uName(v).includes(q)) ||
        uName(t.client).includes(q) ||
        uName(t.assignee).includes(q);

      const matchModule = selectedModule ? t.module?.id === selectedModule : true;
      const matchAssignee = selectedAssignee
        ? [
            ...(t.managers || []),
            ...(t.developers || []),
            ...(t.verifiers || []),
            t.manager,
            t.assignee,
          ].some((u: any) => u && (u.id || u.userId) === selectedAssignee)
        : true;
      return matchSearch && matchModule && matchAssignee;
    });
  }, [tasks, search, selectedModule, selectedAssignee]);

  return {
    tasks: filteredTasks,
    allTasks: tasks,
    modules,
    users: usersFromTasks,   // derived from task data — no extra API call
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
