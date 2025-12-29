// @ts-check
import { jest } from '@jest/globals';
import path from 'path';
import fs from 'fs';
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
    
    // Mock console methods
    console.log = jest.fn();
    console.error = jest.fn();
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
    test('should handle updateInterfaceGatewayState method', () => {
      const manager = new ConfigurationManager();
      
      expect(() => {
        manager.updateInterfaceGatewayState('test-sim', true, 'connected', null, mockConfig);
      }).not.toThrow();
    });

    test('should throw error when updating non-existent sim', () => {
      const manager = new ConfigurationManager();
      
      expect(() => {
        manager.updateInterfaceGatewayState('non-existent', true, 'connected', null, mockConfig);
      }).toThrow("Host with simulation ID 'non-existent' not found");
    });
  });

  describe('loadConfig validation', () => {
    const sampleConfigBase = {
      games: [
        {
          sim: 'test-sim',
          host: 'localhost',
          port: 55555,
          channel: '/topic/TRAIN_MVT_ALL_TOC',
          enabled: true,
          interfaceGateway: {
            port: 8000,
            enabled: false,
            connectionState: 'disconnected',
            errorMessage: null
          }
        }
      ],
      server: { port: 8080 },
      token: 'test-token',
      prefix: '!',
      guild: 'test-guild'
    };

    test('loadConfig throws when encryptionKey is missing', () => {
      const tempPath = path.join(process.cwd(), 'test-config-no-key.json');
      const invalidConfig = { ...sampleConfigBase };
      fs.writeFileSync(tempPath, JSON.stringify(invalidConfig, null, 2), 'utf8');

      const manager = new ConfigurationManager(tempPath);
      expect(() => manager.loadConfig()).toThrow(/encryptionKey/);

      fs.unlinkSync(tempPath);
    });

    test('loadConfig succeeds when encryptionKey is present', () => {
      const tempPath = path.join(process.cwd(), 'test-config-with-key.json');
      const validConfig = { ...sampleConfigBase, encryptionKey: 'test-key-123' };
      fs.writeFileSync(tempPath, JSON.stringify(validConfig, null, 2), 'utf8');

      const manager = new ConfigurationManager(tempPath);
      expect(() => manager.loadConfig()).not.toThrow();

      // Cleanup
      fs.unlinkSync(tempPath);
    });
  });

  describe('async saveConfig behavior', () => {
    const sampleSaveConfig = {
      games: [],
      server: { port: 3000 },
      token: 'abc',
      prefix: '!',
      guild: 'g',
      encryptionKey: 'k'
    };

    afterEach(() => {
      jest.restoreAllMocks();
      delete process.env.ROC_CONFIG_SAVE_TIMEOUT_MS;
    });

    test('saveConfig times out when writeFile never resolves', async () => {
      const manager = new ConfigurationManager('/tmp/test-config.json');

      // Simulate file exists for backup
      jest.spyOn(fs.promises, 'access').mockResolvedValue();
      jest.spyOn(fs.promises, 'copyFile').mockResolvedValue();
      // writeFile never resolves
      jest.spyOn(fs.promises, 'writeFile').mockImplementation(() => new Promise(() => {}));

      process.env.ROC_CONFIG_SAVE_TIMEOUT_MS = '50';

      await expect(manager.saveConfig(sampleSaveConfig)).rejects.toThrow(/timed out/);
    });

    test('saveConfig succeeds when writeFile resolves', async () => {
      const manager = new ConfigurationManager('/tmp/test-config.json');

      jest.spyOn(fs.promises, 'access').mockResolvedValue();
      jest.spyOn(fs.promises, 'copyFile').mockResolvedValue();
      jest.spyOn(fs.promises, 'writeFile').mockResolvedValue();

      await expect(manager.saveConfig(sampleSaveConfig)).resolves.toBeUndefined();
      expect(manager.getCachedConfig()).toEqual(sampleSaveConfig);
    });
  });
});
