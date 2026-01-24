import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import axios from 'axios';
import { DevArkError } from '../../../src/utils/errors';
import * as config from '../../../src/lib/config';
import { setupTestEnv, cleanupTestEnv, testData } from '../../test-utils';

// Mock modules
vi.mock('axios');
vi.mock('../../../src/lib/config');

describe('API Client Module', () => {
  let mockAxiosInstance: any;
  let apiClient: any;

  beforeEach(async () => {
    setupTestEnv();
    
    // Clear module cache
    vi.resetModules();
    
    // Create mock axios instance
    mockAxiosInstance = {
      get: vi.fn(),
      post: vi.fn(),
      interceptors: {
        request: { use: vi.fn() },
        response: { use: vi.fn() },
      },
    };
    
    // Mock axios.create to return our mock instance
    vi.mocked(axios.create).mockReturnValue(mockAxiosInstance as any);
    
    // Mock config functions
    vi.mocked(config.getApiUrl).mockReturnValue('https://test.devark.ai');
    vi.mocked(config.getToken).mockResolvedValue('testtoken123456789012345678901234567890');
    
    // Import apiClient after mocks are set up
    const apiClientModule = await import('../../../src/lib/api-client');
    apiClient = apiClientModule.apiClient;
  });

  afterEach(() => {
    cleanupTestEnv();
  });

  describe('Authentication', () => {
    it('should create auth session', async () => {
      const authUrl = 'https://devark.ai/auth/cli/test-session-123';
      const token = 'session-token-123456789012345678901234567890';
      
      mockAxiosInstance.post.mockResolvedValue({
        data: { authUrl, sessionId: token },
      });
      
      const result = await apiClient.createAuthSession();
      
      expect(result).toEqual({ authUrl, token });
      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/api/auth/cli/session', {
        timestamp: expect.any(String),
      });
    });

    it('should check auth completion', async () => {
      const token = 'test-token-123456789012345678901234567890';
      const mockResponse = { success: true, userId: 1 };
      
      mockAxiosInstance.get.mockResolvedValue({
        data: mockResponse,
      });
      
      const result = await apiClient.checkAuthCompletion(token);
      
      expect(result).toEqual(mockResponse);
      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        `/api/auth/cli/complete?token=${token}`
      );
    });

    it('should verify token', async () => {
      mockAxiosInstance.get.mockResolvedValue({
        data: { valid: true, user: { id: 1, email: 'test@example.com' } },
      });
      
      const result = await apiClient.verifyToken();
      
      expect(result).toEqual({
        valid: true,
        user: { id: 1 },
      });
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/api/auth/cli/verify');
    });

    it('should return invalid for failed token verification', async () => {
      mockAxiosInstance.get.mockRejectedValue(new Error('Unauthorized'));
      
      const result = await apiClient.verifyToken();
      
      expect(result).toEqual({ valid: false });
    });
  });

  describe('Session Management', () => {
    it('should upload sessions', async () => {
      const sessions = [testData.createSession()];
      const mockServerResponse = {
        success: true,
        created: 1,
        duplicates: 0,
        analysisPreview: 'Great coding session!',
        streak: testData.createStreakInfo(),
      };
      
      mockAxiosInstance.post.mockResolvedValue({
        data: mockServerResponse,
      });
      
      const result = await apiClient.uploadSessions(sessions);
      
      // The mergeResults method now returns additional fields
      expect(result).toEqual({
        success: true,
        created: 1,
        duplicates: 0,
        sessionsProcessed: 1, // created + duplicates
        analysisPreview: 'Great coding session!',
        streak: testData.createStreakInfo(),
        batchId: undefined,
      });
      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/cli/sessions',
        expect.objectContaining({
          sessions: expect.any(Array),
          checksum: expect.any(String),
          telemetry: expect.objectContaining({
            cliVersion: expect.any(String),
            statusLinePersonality: expect.any(String),
          }),
          batchNumber: expect.any(Number),
          totalBatches: expect.any(Number),
          totalSessions: expect.any(Number),
        }),
        expect.any(Object)  // headers object
      );
    });

    it('should get streak info', async () => {
      const streakInfo = testData.createStreakInfo();
      
      mockAxiosInstance.get.mockResolvedValue({
        data: streakInfo,
      });
      
      const result = await apiClient.getStreak();
      
      expect(result).toEqual(streakInfo);
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/api/user/streak');
    });

    it('should get recent sessions', async () => {
      const recentSessions = [
        { timestamp: '2024-01-15T10:00:00Z', duration: 3600, projectName: 'test-project' },
      ];
      
      mockAxiosInstance.get.mockResolvedValue({
        data: recentSessions,
      });
      
      const result = await apiClient.getRecentSessions(5);
      
      expect(result).toEqual(recentSessions);
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/api/sessions/recent', {
        params: { limit: 5 },
      });
    });

    it('should use default limit for recent sessions', async () => {
      mockAxiosInstance.get.mockResolvedValue({ data: [] });
      
      await apiClient.getRecentSessions();
      
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/api/sessions/recent', {
        params: { limit: 10 },
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle 401 errors', async () => {
      const error = {
        response: { status: 401, data: {}, headers: {} },
        isAxiosError: true,
        message: 'Unauthorized',
        config: {},
      };
      
      // Get the response error interceptor
      const errorInterceptor = mockAxiosInstance.interceptors.response.use.mock.calls[0]?.[1];
      
      if (errorInterceptor) {
        try {
          await errorInterceptor(error);
          expect.fail('Should have thrown an error');
        } catch (e: any) {
          expect(e.message).toBe('Your session has expired. Please authenticate again');
          expect(e.code).toBe('AUTH_EXPIRED');
        }
      }
    });

    it('should handle 429 rate limit errors', async () => {
      const error = {
        response: { status: 429, data: {}, headers: { 'retry-after': '60' } },
        isAxiosError: true,
        message: 'Too Many Requests',
        config: {},
      };
      
      // Get the response error interceptor
      const errorInterceptor = mockAxiosInstance.interceptors.response.use.mock.calls[0]?.[1];
      
      if (errorInterceptor) {
        try {
          await errorInterceptor(error);
          expect.fail('Should have thrown an error');
        } catch (e: any) {
          expect(e.message).toContain('Too many requests');
          expect(e.code).toBe('RATE_LIMITED');
        }
      }
    });

    it('should handle network errors', async () => {
      const error: any = {
        code: 'ENOTFOUND',
        isAxiosError: true,
        message: 'Network error',
        config: { baseURL: 'https://test.devark.ai' },
      };
      
      // Get the response error interceptor
      const errorInterceptor = mockAxiosInstance.interceptors.response.use.mock.calls[0]?.[1];
      
      if (errorInterceptor) {
        try {
          await errorInterceptor(error);
          expect.fail('Should have thrown an error');
        } catch (e: any) {
          expect(e.message).toContain('Cannot reach devark servers');
          expect(e.code).toBe('NETWORK_ERROR');
        }
      }
    });

    it('should handle connection refused errors', async () => {
      const error: any = {
        code: 'ECONNREFUSED',
        isAxiosError: true,
        message: 'Connection refused',
        config: { baseURL: 'https://test.devark.ai' },
      };
      
      // Get the response error interceptor
      const errorInterceptor = mockAxiosInstance.interceptors.response.use.mock.calls[0]?.[1];
      
      if (errorInterceptor) {
        try {
          await errorInterceptor(error);
          expect.fail('Should have thrown an error');
        } catch (e: any) {
          expect(e.message).toContain('Connection refused');
          expect(e.code).toBe('CONNECTION_REFUSED');
        }
      }
    });

    it('should propagate other errors', async () => {
      const error = new Error('Unknown error');
      
      mockAxiosInstance.get.mockRejectedValue(error);
      
      await expect(apiClient.getStreak()).rejects.toThrow('Unknown error');
    });
  });

  describe('Request Interceptors', () => {
    it('should add authorization header when token exists', async () => {
      // Get the request interceptor function
      const requestInterceptor = mockAxiosInstance.interceptors.request.use.mock.calls[0][0];
      
      const config = { headers: {} };
      const result = await requestInterceptor(config);
      
      expect(result.headers.Authorization).toBe('Bearer testtoken123456789012345678901234567890');
      expect(result.baseURL).toBe('https://test.devark.ai');
    });

    it('should not add authorization header when no token', async () => {
      vi.mocked(config.getToken).mockResolvedValue(null);
      
      const requestInterceptor = mockAxiosInstance.interceptors.request.use.mock.calls[0][0];
      
      const requestConfig = { headers: {} };
      const result = await requestInterceptor(requestConfig);
      
      expect(result.headers.Authorization).toBeUndefined();
    });
  });

  describe('Timeout and Headers', () => {
    it('should configure axios with correct defaults', () => {
      expect(axios.create).toHaveBeenCalledWith(
        expect.objectContaining({
          timeout: 30000,
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
        })
      );
    });
  });

  describe('Telemetry', () => {
    it('should update telemetry data', async () => {
      const telemetryData = {
        cliVersion: '1.0.0',
        platform: 'darwin',
        nodeVersion: 'v18.0.0',
        statusLinePersonality: 'default',
      };

      mockAxiosInstance.post.mockResolvedValue({ data: { success: true } });

      await apiClient.updateTelemetry(telemetryData);

      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/api/cli-telemetry', telemetryData);
    });

    it('should handle telemetry update errors', async () => {
      const telemetryData = {
        cliVersion: '1.0.0',
        platform: 'darwin',
        nodeVersion: 'v18.0.0',
        statusLinePersonality: 'default',
      };

      mockAxiosInstance.post.mockRejectedValue(new Error('Network error'));

      // Telemetry errors are propagated (no try-catch in updateTelemetry)
      await expect(apiClient.updateTelemetry(telemetryData)).rejects.toThrow('Network error');
    });
  });

  describe('Recent Sessions with Date Filters', () => {
    it('should get recent sessions with date range', async () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');
      const mockSessions = [
        { timestamp: '2024-01-15T10:00:00Z', duration: 3600, projectName: 'test' },
      ];

      mockAxiosInstance.get.mockResolvedValue({ data: mockSessions });

      const result = await apiClient.getRecentSessions(20, startDate, endDate);

      expect(result).toEqual(mockSessions);
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/api/sessions/recent', {
        params: {
          limit: 20,
          start: startDate.toISOString(),
          end: endDate.toISOString(),
        },
      });
    });

    it('should handle only startDate parameter', async () => {
      const startDate = new Date('2024-01-01');

      mockAxiosInstance.get.mockResolvedValue({ data: [] });

      await apiClient.getRecentSessions(10, startDate);

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/api/sessions/recent', {
        params: {
          limit: 10,
          start: startDate.toISOString(),
        },
      });
    });
  });

  describe('Upload Error Handling', () => {
    it('should propagate upload errors', async () => {
      const sessions = [testData.createSession()];

      mockAxiosInstance.post.mockRejectedValue(new Error('Upload failed'));

      await expect(apiClient.uploadSessions(sessions)).rejects.toThrow('Upload failed');
    });

    it('should handle validation errors', async () => {
      const sessions = [testData.createSession()];

      mockAxiosInstance.post.mockRejectedValue(new Error('Invalid session data'));

      await expect(apiClient.uploadSessions(sessions)).rejects.toThrow('Invalid session data');
    });
  });

  describe('Batch Upload', () => {
    // Helper for creating sessions with specific sizes for batch testing
    function createLargeSession(sizeKB: number) {
      const baseSize = 300;
      const targetBytes = sizeKB * 1024;
      const paddingNeeded = Math.max(0, targetBytes - baseSize);
      const padding = 'x'.repeat(paddingNeeded);

      return testData.createSession({
        data: {
          projectName: 'test-project',
          messageSummary: JSON.stringify({ padding, stats: {} }),
          messageCount: 10,
          metadata: { files_edited: 1, languages: ['typescript'] },
        },
      });
    }

    it('should handle large session batches', async () => {
      // Create sessions large enough to require multiple batches
      // 10 sessions at 100KB each = 1000KB total, should create ~3 batches (400KB effective limit)
      const sessions = Array.from({ length: 10 }, () => createLargeSession(100));

      mockAxiosInstance.post.mockResolvedValue({
        data: { success: true, created: 4, duplicates: 0 },
      });

      await apiClient.uploadSessions(sessions);

      // Should make multiple calls due to size-based batching
      expect(mockAxiosInstance.post.mock.calls.length).toBeGreaterThanOrEqual(2);

      // Verify batch metadata is included
      expect(mockAxiosInstance.post.mock.calls[0][1].batchNumber).toBe(1);
      expect(mockAxiosInstance.post.mock.calls[0][1].totalBatches).toBeGreaterThanOrEqual(2);
    });

    it('should aggregate results from multiple batches', async () => {
      // Create sessions that will split into multiple batches
      const sessions = Array.from({ length: 10 }, () => createLargeSession(100));

      // Mock returns same response for all batches
      mockAxiosInstance.post.mockResolvedValue({
        data: { success: true, created: 3, duplicates: 1 },
      });

      const result = await apiClient.uploadSessions(sessions);

      // Results should be aggregated from all batches
      expect(result.created).toBeGreaterThanOrEqual(3);
      expect(result.success).toBe(true);
    });

    it('should call progress callback during batch upload', async () => {
      const sessions = Array.from({ length: 10 }, () => createLargeSession(100));
      const progressCallback = vi.fn();

      mockAxiosInstance.post.mockResolvedValue({
        data: { success: true, created: 4, duplicates: 0 },
      });

      await apiClient.uploadSessions(sessions, progressCallback);

      // Progress should be called for each batch
      expect(progressCallback).toHaveBeenCalled();
    });
  });

  describe('Size-Based Batching', () => {
    // Helper to create session with specific size
    function createSessionWithSize(sizeKB: number) {
      const baseSize = 300;
      const targetBytes = sizeKB * 1024;
      const paddingNeeded = Math.max(0, targetBytes - baseSize);
      const padding = 'x'.repeat(paddingNeeded);

      return testData.createSession({
        data: {
          projectName: 'test-project',
          messageSummary: JSON.stringify({ padding, stats: {} }),
          messageCount: 10,
          metadata: { files_edited: 1, languages: ['typescript'] },
        },
      });
    }

    it('should batch by payload size not session count', async () => {
      // 10 large sessions at 50KB each = 500KB total
      // Should create 2 batches (not 1 batch of 10 by count)
      const sessions = Array.from({ length: 10 }, () => createSessionWithSize(50));

      mockAxiosInstance.post.mockResolvedValue({
        data: { success: true, created: 5, duplicates: 0 },
      });

      await apiClient.uploadSessions(sessions);

      // Should make 2+ calls due to size, not 1
      expect(mockAxiosInstance.post).toHaveBeenCalledTimes(2);
    });

    it('should keep small sessions in single batch up to ~400KB', async () => {
      // 50 small sessions at 5KB each = 250KB total (under 400KB limit)
      const sessions = Array.from({ length: 50 }, () => createSessionWithSize(5));

      mockAxiosInstance.post.mockResolvedValue({
        data: { success: true, created: 50, duplicates: 0 },
      });

      await apiClient.uploadSessions(sessions);

      // Should make exactly 1 call
      expect(mockAxiosInstance.post).toHaveBeenCalledTimes(1);
      expect(mockAxiosInstance.post.mock.calls[0][1].sessions).toHaveLength(50);
    });

    it('should split into multiple batches when exceeding ~400KB', async () => {
      // 20 sessions at 50KB each = 1000KB total
      // Should create ~3 batches (1000KB / 400KB effective limit)
      const sessions = Array.from({ length: 20 }, () => createSessionWithSize(50));

      mockAxiosInstance.post.mockResolvedValue({
        data: { success: true, created: 7, duplicates: 0 },
      });

      await apiClient.uploadSessions(sessions);

      // Should make 3+ calls
      expect(mockAxiosInstance.post.mock.calls.length).toBeGreaterThanOrEqual(3);
    });

    it('should handle single session exceeding target size', async () => {
      // Single 600KB session (exceeds 500KB target)
      const hugeSession = createSessionWithSize(600);

      mockAxiosInstance.post.mockResolvedValue({
        data: { success: true, created: 1, duplicates: 0 },
      });

      await apiClient.uploadSessions([hugeSession]);

      // Should still upload successfully as single batch
      expect(mockAxiosInstance.post).toHaveBeenCalledTimes(1);
      expect(mockAxiosInstance.post.mock.calls[0][1].sessions).toHaveLength(1);
    });

    it('should report accurate batch count in payload metadata', async () => {
      // 4 sessions at 150KB each = 600KB total
      // Should create 2 batches (2 sessions per batch at ~300KB each, under 400KB limit)
      const sessions = Array.from({ length: 4 }, () => createSessionWithSize(150));

      mockAxiosInstance.post.mockResolvedValue({
        data: { success: true, created: 2, duplicates: 0 },
      });

      await apiClient.uploadSessions(sessions);

      const calls = mockAxiosInstance.post.mock.calls;
      expect(calls.length).toBe(2);

      // First batch metadata
      expect(calls[0][1].batchNumber).toBe(1);
      expect(calls[0][1].totalBatches).toBe(2);

      // Second batch metadata
      expect(calls[1][1].batchNumber).toBe(2);
      expect(calls[1][1].totalBatches).toBe(2);
    });

    it('should call progress callback for each size-based batch', async () => {
      // 4 sessions at 150KB each = 600KB total, 2 batches
      const sessions = Array.from({ length: 4 }, () => createSessionWithSize(150));
      const progressCallback = vi.fn();

      mockAxiosInstance.post.mockResolvedValue({
        data: { success: true, created: 2, duplicates: 0 },
      });

      await apiClient.uploadSessions(sessions, progressCallback);

      // Should have 2 progress calls (one per batch)
      expect(progressCallback).toHaveBeenCalledTimes(2);
    });
  });
});