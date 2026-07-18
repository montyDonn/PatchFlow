import { describe, it, expect } from 'vitest';
import axios from 'axios';

const BASE_URL = 'http://localhost:5001/api';

describe('End-to-End Patch Flow Lifecycle', () => {
  it('should create a patch flow and move it across all stages successfully', async () => {
    try {
      // 1. Login as admin
      const loginRes = await axios.post(`${BASE_URL}/auth/login`, {
        username: 'admin',
        password: 'upcl@123',
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

      // 5. Move across stages – approved v2 workflow:
      // Draft → Pending Approval → Assigned → In Development → Testing
      //   → Manager Review → Deployment → Final Testing of Patch → Completed
      // Return paths exercised: Testing→InDev, ManagerReview→InDev, FinalTesting→InDev
      let currentStatus = task.status;

      if (currentStatus === 'DRAFT') {
        const updated = await updateTaskStatus(task.id, 'PENDING_APPROVAL');
        currentStatus = updated.status;
      }

      if (currentStatus === 'PENDING_APPROVAL') {
        const updated = await updateTaskStatus(task.id, 'ASSIGNED');
        currentStatus = updated.status;
      }

      if (currentStatus === 'ASSIGNED') {
        const updated = await updateTaskStatus(task.id, 'IN_DEVELOPMENT');
        currentStatus = updated.status;
      }

      // Move to TESTING
      if (currentStatus === 'IN_DEVELOPMENT') {
        const updated = await updateTaskStatus(task.id, 'TESTING');
        currentStatus = updated.status;
      }

      // Test return path: TESTING → IN_DEVELOPMENT
      if (currentStatus === 'TESTING') {
        console.log('[E2E] Testing return path: TESTING → IN_DEVELOPMENT');
        const returned = await updateTaskStatus(task.id, 'IN_DEVELOPMENT');
        currentStatus = returned.status;
        expect(currentStatus).toBe('IN_DEVELOPMENT');
        // Move back to TESTING
        const reTested = await updateTaskStatus(task.id, 'TESTING');
        currentStatus = reTested.status;
      }

      // Move to MANAGER_REVIEW
      if (currentStatus === 'TESTING') {
        const updated = await updateTaskStatus(task.id, 'MANAGER_REVIEW');
        currentStatus = updated.status;
      }

      // Test return path: MANAGER_REVIEW → IN_DEVELOPMENT
      if (currentStatus === 'MANAGER_REVIEW') {
        console.log('[E2E] Testing return path: MANAGER_REVIEW → IN_DEVELOPMENT');
        const returned = await updateTaskStatus(task.id, 'IN_DEVELOPMENT');
        currentStatus = returned.status;
        expect(currentStatus).toBe('IN_DEVELOPMENT');
        // Move back up through flow
        const t1 = await updateTaskStatus(task.id, 'TESTING');        currentStatus = t1.status;
        const t2 = await updateTaskStatus(task.id, 'MANAGER_REVIEW'); currentStatus = t2.status;
      }

      // Move to DEPLOYMENT
      if (currentStatus === 'MANAGER_REVIEW') {
        const updated = await updateTaskStatus(task.id, 'DEPLOYMENT');
        currentStatus = updated.status;
      }

      // Move to FINAL_TESTING_OF_PATCH
      if (currentStatus === 'DEPLOYMENT') {
        const updated = await updateTaskStatus(task.id, 'FINAL_TESTING_OF_PATCH');
        currentStatus = updated.status;
      }

      // Test return path: FINAL_TESTING_OF_PATCH → IN_DEVELOPMENT
      if (currentStatus === 'FINAL_TESTING_OF_PATCH') {
        console.log('[E2E] Testing return path: FINAL_TESTING_OF_PATCH → IN_DEVELOPMENT');
        const returned = await updateTaskStatus(task.id, 'IN_DEVELOPMENT');
        currentStatus = returned.status;
        expect(currentStatus).toBe('IN_DEVELOPMENT');
        const t1 = await updateTaskStatus(task.id, 'TESTING');                currentStatus = t1.status;
        const t2 = await updateTaskStatus(task.id, 'MANAGER_REVIEW');         currentStatus = t2.status;
        const t3 = await updateTaskStatus(task.id, 'DEPLOYMENT');             currentStatus = t3.status;
        const t4 = await updateTaskStatus(task.id, 'FINAL_TESTING_OF_PATCH'); currentStatus = t4.status;
      }

      // Move to COMPLETED
      if (currentStatus === 'FINAL_TESTING_OF_PATCH') {
        const updated = await updateTaskStatus(task.id, 'COMPLETED');
        currentStatus = updated.status;
      }

      expect(currentStatus).toBe('COMPLETED');
      console.log('[E2E] Patch flow completed successfully across all stages (including return paths)!');
    } catch (err: any) {
      const responseData = err.response?.data;
      const responseStatus = err.response?.status;
      const message = err.message;
      console.error('[E2E Error]', { message, responseStatus, responseData });
      throw new Error(`Test failed: ${message} - Status: ${responseStatus} - Data: ${JSON.stringify(responseData)}`);
    }
  }, 60000);
});
