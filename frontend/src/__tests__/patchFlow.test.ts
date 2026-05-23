import { describe, it, expect } from 'vitest';
import axios from 'axios';

const BASE_URL = 'http://localhost:8080/api';

describe('End-to-End Patch Flow Lifecycle', () => {
  it('should create a patch flow and move it across all stages successfully', async () => {
    try {
      // 1. Login as admin
      const loginRes = await axios.post(`${BASE_URL}/auth/login`, {
        username: 'admin',
        password: 'admin123',
      });

      expect(loginRes.status).toBe(200);
      const { token, user } = loginRes.data;
      expect(token).toBeDefined();
      expect(user).toBeDefined();

      const authHeaders = {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      };

      // 2. Fetch active modules
      const modulesRes = await axios.get(`${BASE_URL}/modules`, authHeaders);
      expect(modulesRes.status).toBe(200);
      expect(modulesRes.data.length).toBeGreaterThan(0);
      const selectedModule = modulesRes.data[0];
      const moduleId = selectedModule.id;
      console.log(`[E2E] Selected Module: ${selectedModule.name} (${moduleId})`);

      // 3. Fetch active users
      const usersRes = await axios.get(`${BASE_URL}/users`, authHeaders);
      expect(usersRes.status).toBe(200);
      expect(usersRes.data.length).toBeGreaterThan(0);

      const developers = usersRes.data.filter((u: any) => u.role === 'DEVELOPER');
      const verifiers = usersRes.data.filter((u: any) => u.role === 'VERIFIER');
      const managers = usersRes.data.filter((u: any) => u.role === 'MANAGER' || u.role === 'ADMIN' || u.role === 'SUPER_ADMIN');

      const devId = developers.length > 0 ? developers[0].id : user.userId;
      const verId = verifiers.length > 0 ? verifiers[0].id : user.userId;
      const mgrId = managers.length > 0 ? managers[0].id : user.userId;

      console.log(`[E2E] Assigned Manager: ${mgrId}, Developer: ${devId}, Verifier: ${verId}`);

      // 4. Create a new task (patch)
      const taskPayload = {
        title: 'E2E Testing Patch Flow',
        description: 'Verifying end to end patch flow transitions from DRAFT to COMPLETED',
        moduleId: moduleId,
        managerIds: [mgrId],
        developerIds: [devId],
        verifierIds: [verId],
        dateGiven: '2026-05-23',
      };

      const createTaskRes = await axios.post(`${BASE_URL}/tasks`, taskPayload, authHeaders);
      expect(createTaskRes.status).toBe(201);
      const task = createTaskRes.data;
      expect(task.id).toBeDefined();
      console.log(`[E2E] Created Task ID: ${task.id}, Initial Status: ${task.status}`);

      // Helper function to update status
      const updateTaskStatus = async (taskId: string, targetStatus: string) => {
        const res = await axios.patch(
          `${BASE_URL}/tasks/${taskId}/status`,
          {
            status: targetStatus,
            reason: `E2E transitioning to ${targetStatus}`,
          },
          authHeaders
        );
        expect(res.status).toBe(200);
        expect(res.data.status).toBe(targetStatus);
        console.log(`[E2E] Task status transitioned to: ${res.data.status}`);
        return res.data;
      };

      // 5. Move across stages
      let currentStatus = task.status;

      // If the task was created as DRAFT, move to ASSIGNED.
      if (currentStatus === 'DRAFT') {
        const updated = await updateTaskStatus(task.id, 'ASSIGNED');
        currentStatus = updated.status;
      }

      // Move to PENDING_APPROVAL
      if (currentStatus === 'ASSIGNED') {
        const updated = await updateTaskStatus(task.id, 'PENDING_APPROVAL');
        currentStatus = updated.status;
      }

      // Move to IN_DEVELOPMENT
      if (currentStatus === 'PENDING_APPROVAL') {
        const updated = await updateTaskStatus(task.id, 'IN_DEVELOPMENT');
        currentStatus = updated.status;
      }

      // Move to VERIFYING
      if (currentStatus === 'IN_DEVELOPMENT') {
        const updated = await updateTaskStatus(task.id, 'VERIFYING');
        currentStatus = updated.status;
      }

      // Move to COMPLETED
      if (currentStatus === 'VERIFYING') {
        const updated = await updateTaskStatus(task.id, 'COMPLETED');
        currentStatus = updated.status;
      }

      expect(currentStatus).toBe('COMPLETED');
      console.log('[E2E] Patch flow completed successfully across all stages!');
    } catch (err: any) {
      const responseData = err.response?.data;
      const responseStatus = err.response?.status;
      const message = err.message;
      console.error('[E2E Error]', { message, responseStatus, responseData });
      throw new Error(`Test failed: ${message} - Status: ${responseStatus} - Data: ${JSON.stringify(responseData)}`);
    }
  }, 30000);
});
