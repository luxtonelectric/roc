// @ts-check
import { jest } from '@jest/globals';
import ConfigurationManager from '../../src/services/ConfigurationManager.js';

// Mock console methods
console.log = jest.fn();
console.warn = jest.fn();
console.error = jest.fn();

describe('ConfigurationManager', () => {
  let mockConfig;
  let tempConfigPath;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup mock configuration with all required fields
    mockConfig = {
      games: [
        {
          sim: 'test-sim',
          host: 'localhost',
          port: 8080,
          channel: 'test-channel',
          enabled: true,
          interfaceGateway: {
            port: 55555,
            enabled: true
          }
        }
      ],
      server: {
        port: 3000
      },
      token: 'test-discord-token',
      prefix: 'test-prefix',
      guild: 'test-guild',
      channels: {
        'test-channel': 'Test Channel'
      }
    };

    tempConfigPath = '/tmp/test-config.json';
  });

  describe('constructor', () => {
    test('should use default config path when none provided', () => {
      const manager = new ConfigurationManager();
      expect(console.log).toHaveBeenCalledWith(
        'ConfigurationManager',
        'Using config path:',
        expect.stringMatching(/config\.json$/)
      );
    });

    test('should use provided config path', () => {
      const customPath = '/custom/config.json';
      const manager = new ConfigurationManager(customPath);
      expect(console.log).toHaveBeenCalledWith(
        'ConfigurationManager',
        'Using config path:',
        path.resolve(customPath)
      );
    });
  });

  describe('loadConfig', () => {
    test('should load and parse configuration file successfully', () => {
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue(JSON.stringify(mockConfig));

      const manager = new ConfigurationManager(tempConfigPath);
      const config = manager.loadConfig();

      expect(fs.existsSync).toHaveBeenCalledWith(tempConfigPath);
      expect(fs.readFileSync).toHaveBeenCalledWith(tempConfigPath, 'utf8');
      expect(config).toEqual(mockConfig);
    });

    test('should throw error when config file does not exist', () => {
      fs.existsSync.mockReturnValue(false);

      const manager = new ConfigurationManager(tempConfigPath);
      
      expect(() => manager.loadConfig()).toThrow(
        `Configuration file not found at ${tempConfigPath}`
      );
    });

    test('should throw error when config file contains invalid JSON', () => {
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue('invalid json content {');

      const manager = new ConfigurationManager(tempConfigPath);
      
      expect(() => manager.loadConfig()).toThrow();
    });

    test('should cache loaded configuration', () => {
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue(JSON.stringify(mockConfig));

      const manager = new ConfigurationManager(tempConfigPath);
      const config1 = manager.loadConfig();
      const config2 = manager.getCachedConfig();

      expect(config1).toEqual(config2);
      expect(fs.readFileSync).toHaveBeenCalledTimes(1); // Only called once due to caching
    });
  });

  describe('getCachedConfig', () => {
    test('should return cached configuration when available', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(JSON.stringify(mockConfig));

      const manager = new ConfigurationManager(tempConfigPath);
      manager.loadConfig();
      
      const cachedConfig = manager.getCachedConfig();
      expect(cachedConfig).toEqual(mockConfig);
    });

    test('should return null when no configuration is cached', () => {
      const manager = new ConfigurationManager(tempConfigPath);
      const cachedConfig = manager.getCachedConfig();
      expect(cachedConfig).toBeNull();
    });
  });

  describe('reloadConfig', () => {
    test('should reload configuration from file', () => {
      const updatedConfig = { ...mockConfig, newField: 'updated' };
      
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync
        .mockReturnValueOnce(JSON.stringify(mockConfig))
        .mockReturnValueOnce(JSON.stringify(updatedConfig));

      const manager = new ConfigurationManager(tempConfigPath);
      
      // Load initial config
      const initialConfig = manager.loadConfig();
      expect(initialConfig).toEqual(mockConfig);
      
      // Reload config
      const reloadedConfig = manager.reloadConfig();
      expect(reloadedConfig).toEqual(updatedConfig);
      expect(mockFs.readFileSync).toHaveBeenCalledTimes(2);
    });
  });

  describe('isConfigLoaded', () => {
    test('should return false when no config is loaded', () => {
      const manager = new ConfigurationManager(tempConfigPath);
      expect(manager.isConfigLoaded()).toBe(false);
    });

    test('should return true after config is loaded', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(JSON.stringify(mockConfig));

      const manager = new ConfigurationManager(tempConfigPath);
      manager.loadConfig();
      
      expect(manager.isConfigLoaded()).toBe(true);
    });
  });

  describe('getConfigPath', () => {
    test('should return the configuration file path', () => {
      const manager = new ConfigurationManager(tempConfigPath);
      expect(manager.getConfigPath()).toBe(tempConfigPath);
    });
  });

  describe('saveConfig', () => {
    test('should save configuration to file with proper formatting', async () => {
      mockFs.writeFileSync.mockImplementation(() => {});
      mockFs.copyFileSync.mockImplementation(() => {});
      mockFs.existsSync.mockReturnValue(false); // No existing config to backup

      const manager = new ConfigurationManager(tempConfigPath);
      await manager.saveConfig(mockConfig);

      expect(mockFs.writeFileSync).toHaveBeenCalledWith(
        tempConfigPath,
        JSON.stringify(mockConfig, null, 2),
        'utf8'
      );
    });

    test('should update cached configuration after saving', async () => {
      mockFs.writeFileSync.mockImplementation(() => {});
      mockFs.copyFileSync.mockImplementation(() => {});
      mockFs.existsSync.mockReturnValue(false); // No existing config to backup

      const manager = new ConfigurationManager(tempConfigPath);
      await manager.saveConfig(mockConfig);

      expect(manager.getCachedConfig()).toEqual(mockConfig);
    });

    test('should handle save errors gracefully', async () => {
      const saveError = new Error('Permission denied');
      mockFs.writeFileSync.mockImplementation(() => {
        throw saveError;
      });
      mockFs.copyFileSync.mockImplementation(() => {});
      mockFs.existsSync.mockReturnValue(false); // No existing config to backup

      const manager = new ConfigurationManager(tempConfigPath);
      
      await expect(manager.saveConfig(mockConfig)).rejects.toThrow('Permission denied');
    });
  });

  describe('integration scenarios (from test-config-manager.js)', () => {
    test('should handle complete configuration workflow', async () => {
      mockFs.existsSync.mockReturnValue(true); // Config file exists
      mockFs.readFileSync.mockReturnValue(JSON.stringify(mockConfig));
      mockFs.writeFileSync.mockImplementation(() => {});
      mockFs.copyFileSync.mockImplementation(() => {});

      const manager = new ConfigurationManager(tempConfigPath);
      
      // Load configuration
      const config = manager.loadConfig();
      expect(config).toEqual(mockConfig);
      expect(manager.isConfigLoaded()).toBe(true);
      
      // Get cached config
      const cachedConfig = manager.getCachedConfig();
      expect(cachedConfig).toEqual(config);
      
      // Modify and save
      const updatedConfig = { ...mockConfig, modified: true };
      await manager.saveConfig(updatedConfig);
      
      expect(manager.getCachedConfig()).toEqual(updatedConfig);
    });

    test('should handle configuration reloading workflow', () => {
      const initialConfig = mockConfig;
      const updatedConfig = { ...mockConfig, version: 2 };
      
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync
        .mockReturnValueOnce(JSON.stringify(initialConfig))
        .mockReturnValueOnce(JSON.stringify(updatedConfig));

      const manager = new ConfigurationManager(tempConfigPath);
      
      // Initial load
      const config1 = manager.loadConfig();
      expect(config1).toEqual(initialConfig);
      
      // Reload to get updates
      const config2 = manager.reloadConfig();
      expect(config2).toEqual(updatedConfig);
      
      // Cached config should be updated
      expect(manager.getCachedConfig()).toEqual(updatedConfig);
    });
  });

  describe('error handling', () => {
    test('should handle file system errors during load', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockImplementation(() => {
        throw new Error('File system error');
      });

      const manager = new ConfigurationManager(tempConfigPath);
      
      expect(() => manager.loadConfig()).toThrow('File system error');
    });

    test('should handle JSON parsing errors', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue('{ invalid json');

      const manager = new ConfigurationManager(tempConfigPath);
      
      expect(() => manager.loadConfig()).toThrow();
    });
  });
});
