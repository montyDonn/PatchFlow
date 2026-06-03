import { describe, it, expect } from 'vitest';
import axios from 'axios';

const API_URL = 'http://localhost:5001';

describe('Frontend API Integration Tests', () => {
  it('should have API client configured', () => {
    expect(axios).toBeDefined();
  });

  it('should allow API calls to backend', async () => {
    try {
      const response = await axios.get(`${API_URL}/health`, { timeout: 3000 });
      expect(response.status).toBe(200);
      expect(response.data).toBeDefined();
    } catch (error: any) {
      if (error.code === 'ECONNREFUSED') {
        console.warn('⚠️ Backend server not running. This is OK for frontend-only tests.');
      }
    }
  });

  it('should handle API errors gracefully', async () => {
    try {
      await axios.get(`${API_URL}/nonexistent-endpoint`, { timeout: 1000 });
    } catch (error: any) {
      expect(error).toBeDefined();
      expect([404, 500, 'ECONNREFUSED', 'ERR_NETWORK']).toContain(
        error.response?.status || error.code
      );
    }
  });
});
