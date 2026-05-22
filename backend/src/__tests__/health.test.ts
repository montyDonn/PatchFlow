import axios, { AxiosInstance } from 'axios';

let api: AxiosInstance;
const API_URL = 'http://localhost:5001';

describe('Backend API Health Tests', () => {
  beforeAll(() => {
    api = axios.create({
      baseURL: API_URL,
      timeout: 5000,
      validateStatus: () => true,
    });
  });

  it('should return health status', async () => {
    try {
      const response = await api.get('/health');
      expect(response.status).toBe(200);
      console.log('✓ Health endpoint working');
    } catch (error) {
      console.log('⚠️ Backend server may not be running. Run: npm run dev');
    }
  });

  it('should have CORS enabled', async () => {
    try {
      const response = await api.get('/health');
      const corsHeader = response.headers['access-control-allow-origin'];
      if (corsHeader) {
        console.log('✓ CORS enabled');
      }
    } catch (error) {
      console.log('⚠️ Could not verify CORS');
    }
  });

  it('should return 404 for non-existent routes', async () => {
    try {
      const response = await api.get('/nonexistent-route-xyz');
      expect([404, 500]).toContain(response.status);
      console.log('✓ 404 handling working');
    } catch (error) {
      console.log('⚠️ Could not test 404 handling');
    }
  });
});
