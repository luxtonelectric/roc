// @ts-check
import { jest } from '@jest/globals';
import path from 'path';
import ConfigurationManager from '../../src/services/ConfigurationManager.js';

// Mock chalk
jest.mock('chalk', () => ({
  blue: jest.fn((msg) => msg),
  green: jest.fn((msg) => msg),
  yellow: jest.fn((msg) => msg),
  red: jest.fn((msg) => msg)
}));

// Mock console methods to capture output
const originalConsole = {
  log: console.log,
  info: console.info,
  error: console.error
};

beforeAll(() => {
  console.log = jest.fn();
  console.info = jest.fn();
  console.error = jest.fn();
});

afterAll(() => {
  // Restore original console methods
  console.log = originalConsole.log;
  console.info = originalConsole.info;
  console.error = originalConsole.error;
  
  // Clear all mocks and timers
  jest.clearAllMocks();
  jest.clearAllTimers();
  jest.restoreAllMocks();
});

describe('ConfigurationManager', () => {
  const mockConfig = {
    port: 8080,
    games: [
      {
        sim: 'test-sim',
        host: 'localhost',
        port: 55555,
        channel: '/topic/TRAIN_MVT_ALL_TOC',
        enabled: true,
        interfaceGateway: {
          enabled: false,
          connectionState: 'disconnected',
          errorMessage: null
        }
      }
    ],
    discord: {
      token: 'test-token',
      guildId: 'test-guild',
      channelId: 'test-channel'
    }
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.clearAllTimers();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  describe('constructor', () => {
    test('should initialize without throwing', () => {
      expect(() => new ConfigurationManager()).not.toThrow();
    });

    test('should initialize with custom path without throwing', () => {
      const customPath = 'custom-config.json';
      expect(() => new ConfigurationManager(customPath)).not.toThrow();
    });
  });

  describe('basic getters (no file system required)', () => {
    test('should return null for getCachedConfig when no config is loaded', () => {
      const manager = new ConfigurationManager();
      expect(manager.getCachedConfig()).toBeNull();
    });

    test('should return false for isConfigLoaded when no config is loaded', () => {
      const manager = new ConfigurationManager();
      expect(manager.isConfigLoaded()).toBe(false);
    });

    test('should return the configuration file path', () => {
      const customPath = 'test-config.json';
      const manager = new ConfigurationManager(customPath);
      expect(manager.getConfigPath()).toContain('test-config.json');
    });
  });

  describe('configuration manipulation methods', () => {
    test('should handle getHost method', () => {
      const manager = new ConfigurationManager();
      
      const host = manager.getHost('test-sim', mockConfig);
      expect(host).toEqual(mockConfig.games[0]);
    });

    test('should return undefined for getHost when sim not found', () => {
      const manager = new ConfigurationManager();
      
      const host = manager.getHost('non-existent-sim', mockConfig);
      expect(host).toBeNull();
    });

    test('should handle getHosts method', () => {
      const manager = new ConfigurationManager();
      
      const hosts = manager.getHosts(mockConfig);
      expect(hosts).toEqual(mockConfig.games);
      expect(hosts).toHaveLength(1);
    });
  });

  describe('interface gateway state updates', () => {
    test('should throw error when updating non-existent sim', () => {
      const manager = new ConfigurationManager();
      
      expect(() => {
        manager.updateInterfaceGatewayState('non-existent', true, 'connected', null, mockConfig);
      }).toThrow("Host with simulation ID 'non-existent' not found");
    });
  });
});
