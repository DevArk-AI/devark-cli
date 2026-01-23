import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createCloudStatusSection, createStatusDashboard } from '../status-sections';

// Mock the styles module to avoid ANSI color codes in tests
vi.mock('../styles', () => ({
  colors: {
    primary: (s: string) => s,
    success: (s: string) => s,
    error: (s: string) => s,
    warning: (s: string) => s,
    muted: (s: string) => s,
    subdued: (s: string) => s,
    highlight: (s: string) => s,
  },
  icons: {
    success: '[ok]',
    error: '[err]',
    warning: '[warn]',
    check: '[check]',
    cross: '[x]',
    clock: '[clock]',
    cloud: '[cloud]',
    bullet: '*',
  },
  box: {
    topLeft: '+',
    topRight: '+',
    bottomLeft: '+',
    bottomRight: '+',
    horizontal: '-',
    vertical: '|',
    doubleTopLeft: '+',
    doubleTopRight: '+',
    doubleBottomLeft: '+',
    doubleBottomRight: '+',
    doubleHorizontal: '=',
    doubleVertical: '|',
  },
  getTerminalWidth: () => 80,
}));

describe('createCloudStatusSection', () => {
  const baseStatus = {
    connected: true,
    hooksEnabled: false,
    syncStatus: 'synced' as const,
  };

  describe('Last synced display', () => {
    it('shows "Never synced" when no dates are provided', () => {
      const result = createCloudStatusSection(baseStatus);
      expect(result).toContain('Never synced');
    });

    it('uses local config lastSync when no server date provided', () => {
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
      const status = { ...baseStatus, lastSync: fiveMinutesAgo };

      const result = createCloudStatusSection(status);
      expect(result).toContain('5 min ago');
    });

    it('uses server date over local config when both provided', () => {
      const localDate = new Date(Date.now() - 60 * 60 * 1000); // 1 hour ago
      const serverDate = new Date(Date.now() - 5 * 60 * 1000); // 5 minutes ago
      const status = { ...baseStatus, lastSync: localDate };

      const result = createCloudStatusSection(status, serverDate);
      expect(result).toContain('5 min ago');
      expect(result).not.toContain('1 hour ago');
    });

    it('shows project name only for local config, not server date', () => {
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
      const status = {
        ...baseStatus,
        lastSync: fiveMinutesAgo,
        lastSyncProject: 'my-project'
      };

      // With local config only - should show project name
      const resultLocal = createCloudStatusSection(status);
      expect(resultLocal).toContain('my-project');

      // With server date - should NOT show project name
      const resultServer = createCloudStatusSection(status, fiveMinutesAgo);
      expect(resultServer).not.toContain('my-project');
    });

    it('shows "Just now" for very recent syncs', () => {
      const justNow = new Date();
      const result = createCloudStatusSection(baseStatus, justNow);
      expect(result).toContain('Just now');
    });

    it('shows hours ago correctly', () => {
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
      const result = createCloudStatusSection(baseStatus, twoHoursAgo);
      expect(result).toContain('2 hours ago');
    });

    it('shows days ago correctly', () => {
      const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
      const result = createCloudStatusSection(baseStatus, threeDaysAgo);
      expect(result).toContain('3 days ago');
    });

    it('shows singular "1 day ago"', () => {
      const oneDayAgo = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000);
      const result = createCloudStatusSection(baseStatus, oneDayAgo);
      expect(result).toContain('1 day ago');
    });

    it('shows singular "1 hour ago"', () => {
      const oneHourAgo = new Date(Date.now() - 1 * 60 * 60 * 1000);
      const result = createCloudStatusSection(baseStatus, oneHourAgo);
      expect(result).toContain('1 hour ago');
    });

    it('shows singular "1 min ago"', () => {
      const oneMinAgo = new Date(Date.now() - 1 * 60 * 1000);
      const result = createCloudStatusSection(baseStatus, oneMinAgo);
      expect(result).toContain('1 min ago');
    });
  });
});

describe('createStatusDashboard', () => {
  const cloudStatus = {
    connected: true,
    hooksEnabled: false,
    syncStatus: 'synced' as const,
  };

  const localEngine = {
    installStatus: 'installed' as const,
    subAgentsInstalled: 3,
    totalSubAgents: 3,
    statusLineStatus: 'installed' as const,
  };

  it('passes server date to cloud status section', async () => {
    const serverDate = new Date(Date.now() - 10 * 60 * 1000); // 10 min ago
    const result = await createStatusDashboard(cloudStatus, localEngine, serverDate);
    expect(result).toContain('10 min ago');
  });

  it('works without server date', async () => {
    const result = await createStatusDashboard(cloudStatus, localEngine);
    expect(result).toContain('Never synced');
  });
});
