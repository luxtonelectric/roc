// @ts-check
import Host, { InterfaceGateway } from '../../src/model/host.js';

describe('InterfaceGateway', () => {
  describe('constructor', () => {
    test('creates InterfaceGateway with default values', () => {
      const ig = new InterfaceGateway(8080);
      
      expect(ig.port).toBe(8080);
      expect(ig.enabled).toBe(false);
      expect(ig.connectionState).toBe('disconnected');
      expect(ig.errorMessage).toBeUndefined();
    });

    test('creates InterfaceGateway with all values', () => {
      const ig = new InterfaceGateway(9090, true, 'connected', 'test error');
      
      expect(ig.port).toBe(9090);
      expect(ig.enabled).toBe(true);
      expect(ig.connectionState).toBe('connected');
      expect(ig.errorMessage).toBe('test error');
    });
  });

  describe('fromConfig', () => {
    test('creates InterfaceGateway from minimal config', () => {
      const config = { port: 5555 };
      const ig = InterfaceGateway.fromConfig(config);
      
      expect(ig.port).toBe(5555);
      expect(ig.enabled).toBe(false);
      expect(ig.connectionState).toBe('disconnected');
      expect(ig.errorMessage).toBeUndefined();
    });

    test('creates InterfaceGateway from full config', () => {
      const config = {
        port: 6666,
        enabled: true,
        connectionState: 'error',
        errorMessage: 'Connection failed'
      };
      const ig = InterfaceGateway.fromConfig(config);
      
      expect(ig.port).toBe(6666);
      expect(ig.enabled).toBe(true);
      expect(ig.connectionState).toBe('error');
      expect(ig.errorMessage).toBe('Connection failed');
    });
  });

  describe('toConfig', () => {
    test('converts InterfaceGateway to config object with minimal data', () => {
      const ig = new InterfaceGateway(7777);
      const config = ig.toConfig();
      
      expect(config).toEqual({
        port: 7777,
        enabled: false,
        connectionState: 'disconnected'
      });
    });

    test('converts InterfaceGateway to config object with all data', () => {
      const ig = new InterfaceGateway(8888, true, 'connecting', 'Attempting connection');
      const config = ig.toConfig();
      
      expect(config).toEqual({
        port: 8888,
        enabled: false, // Always saved as false for server restart
        connectionState: 'connecting',
        errorMessage: 'Attempting connection'
      });
    });

    test('toConfig never persists enabled state for server restart consistency', () => {
      // Test that even when IG is enabled, toConfig always saves as disabled
      const enabledIG = new InterfaceGateway(9999, true, 'connected');
      const config = enabledIG.toConfig();
      
      expect(config.enabled).toBe(false);
      
      // Test that disabled IG also saves as disabled (consistent behavior)
      const disabledIG = new InterfaceGateway(9999, false, 'disconnected');
      const config2 = disabledIG.toConfig();
      
      expect(config2.enabled).toBe(false);
    });
  });
});

describe('Host', () => {
  const createValidHostConfig = () => ({
    sim: 'test-sim',
    host: 'localhost',
    port: 8080,
    channel: 'Test Channel',
    interfaceGateway: {
      port: 51515,
      enabled: false
    }
  });

  describe('constructor', () => {
    test('creates Host with minimal required fields', () => {
      const ig = new InterfaceGateway(51515);
      const host = new Host('test-sim', 'localhost', 8080, 'Test Channel', ig);
      
      expect(host.sim).toBe('test-sim');
      expect(host.host).toBe('localhost');
      expect(host.port).toBe(8080);
      expect(host.channel).toBe('Test Channel');
      expect(host.interfaceGateway).toBe(ig);
      expect(host.enabled).toBe(true);
    });

    test('creates Host with all fields', () => {
      const ig = new InterfaceGateway(51515, true);
      const host = new Host('test-sim', 'localhost', 8080, 'Test Channel', ig, false);
      
      expect(host.sim).toBe('test-sim');
      expect(host.host).toBe('localhost');
      expect(host.port).toBe(8080);
      expect(host.channel).toBe('Test Channel');
      expect(host.interfaceGateway).toBe(ig);
      expect(host.enabled).toBe(false);
    });
  });

  describe('fromConfig', () => {
    test('creates Host from valid config', () => {
      const config = createValidHostConfig();
      const host = Host.fromConfig(config);
      
      expect(host.sim).toBe('test-sim');
      expect(host.host).toBe('localhost');
      expect(host.channel).toBe('Test Channel');
      expect(host.interfaceGateway).toBeInstanceOf(InterfaceGateway);
      expect(host.interfaceGateway.port).toBe(51515);
      expect(host.interfaceGateway.enabled).toBe(false);
      expect(host.enabled).toBe(true);
    });

    test('creates Host from config with optional fields', () => {
      const config = {
        ...createValidHostConfig(),
        enabled: false,
        port: 9090,
        interfaceGateway: {
          port: 52525,
          enabled: true,
          connectionState: 'connected'
        }
      };
      const host = Host.fromConfig(config);
      
      expect(host.enabled).toBe(false);
      expect(host.port).toBe(9090);
      expect(host.interfaceGateway.port).toBe(52525);
      expect(host.interfaceGateway.enabled).toBe(true);
      expect(host.interfaceGateway.connectionState).toBe('connected');
    });

    test('throws error for invalid config - missing required field', () => {
      const config = {
        host: 'localhost',
        channel: 'Test Channel',
        interfaceGateway: { port: 51515, enabled: false }
      };
      
      expect(() => Host.fromConfig(config)).toThrow('Host configuration must have a valid \'sim\' string field');
    });

    test('throws error for invalid config - empty string field', () => {
      const config = {
        sim: '',
        host: 'localhost',
        channel: 'Test Channel',
        interfaceGateway: { port: 51515, enabled: false }
      };
      
      expect(() => Host.fromConfig(config)).toThrow('Host configuration must have a valid \'sim\' string field');
    });

    test('throws error for invalid config - missing interfaceGateway', () => {
      const config = {
        sim: 'test-sim',
        host: 'localhost',
        port: 8080,
        channel: 'Test Channel'
      };
      
      expect(() => Host.fromConfig(config)).toThrow('Host configuration must have an interfaceGateway object');
    });

    test('throws error for invalid config - null object', () => {
      expect(() => Host.fromConfig(null)).toThrow('Host configuration must be an object');
    });

    test('throws error for invalid config - not an object', () => {
      expect(() => Host.fromConfig('not an object')).toThrow('Host configuration must be an object');
    });
  });

  describe('toConfig', () => {
    test('converts Host to config object with minimal data', () => {
      const config = createValidHostConfig();
      const host = Host.fromConfig(config);
      const outputConfig = host.toConfig();
      
      expect(outputConfig).toEqual({
        sim: 'test-sim',
        host: 'localhost',
        port: 8080,
        channel: 'Test Channel',
        interfaceGateway: {
          port: 51515,
          enabled: false,
          connectionState: 'disconnected'
        },
        enabled: true
      });
    });

    test('converts Host to config object with all data', () => {
      const config = {
        sim: 'full-sim',
        host: '192.168.1.100',
        channel: 'Full Channel',
        enabled: false,
        port: 8080,
        interfaceGateway: {
          port: 52525,
          enabled: true,
          connectionState: 'connected',
          errorMessage: 'All good'
        }
      };
      const host = Host.fromConfig(config);
      const outputConfig = host.toConfig();
      
      // IG enabled state should always be saved as false
      const expectedConfig = {
        ...config,
        interfaceGateway: {
          ...config.interfaceGateway,
          enabled: false
        }
      };
      
      expect(outputConfig).toEqual(expectedConfig);
    });
  });

  describe('validate', () => {
    test('validates successfully with valid host', () => {
      const config = createValidHostConfig();
      const host = Host.fromConfig(config);
      
      expect(() => host.validate()).not.toThrow();
    });

    test('throws error for missing sim field', () => {
      const ig = new InterfaceGateway(51515);
      const host = new Host('', 'localhost', 8080, 'Test Channel', ig);
      
      expect(() => host.validate()).toThrow('Host configuration must have a valid \'sim\' string field');
    });

    test('throws error for invalid port range - too low', () => {
      const ig = new InterfaceGateway(0);
      const host = new Host('test-sim', 'localhost', 8080, 'Test Channel', ig);
      
      expect(() => host.validate()).toThrow('InterfaceGateway port must be a valid port number (1-65535)');
    });

    test('throws error for invalid port range - too high', () => {
      const ig = new InterfaceGateway(99999);
      const host = new Host('test-sim', 'localhost', 8080, 'Test Channel', ig);
      
      expect(() => host.validate()).toThrow('InterfaceGateway port must be a valid port number (1-65535)');
    });

    test('throws error for invalid host port range', () => {
      const ig = new InterfaceGateway(51515);
      const host = new Host('test-sim', 'localhost', 70000, 'Test Channel', ig);
      
      expect(() => host.validate()).toThrow('Host port must be a valid port number (1-65535)');
    });
  });

  describe('isActive', () => {
    test('returns true for valid enabled host', () => {
      const config = createValidHostConfig();
      const host = Host.fromConfig(config);
      
      expect(host.isActive()).toBe(true);
    });

    test('returns false for disabled host', () => {
      const config = { ...createValidHostConfig(), enabled: false };
      const host = Host.fromConfig(config);
      
      expect(host.isActive()).toBe(false);
    });

    test('returns false for invalid host configuration', () => {
      const ig = new InterfaceGateway(99999); // Invalid port
      const host = new Host('test-sim', 'localhost', 8080, 'Test Channel', ig);
      
      expect(host.isActive()).toBe(false);
    });
  });

  describe('interface gateway management', () => {
    test('enableInterfaceGateway sets correct state', () => {
      const config = createValidHostConfig();
      const host = Host.fromConfig(config);
      
      host.enableInterfaceGateway();
      
      expect(host.interfaceGateway.enabled).toBe(true);
      expect(host.interfaceGateway.connectionState).toBe('connecting');
      expect(host.interfaceGateway.errorMessage).toBeUndefined();
    });

    test('disableInterfaceGateway sets correct state', () => {
      const config = {
        ...createValidHostConfig(),
        interfaceGateway: {
          port: 51515,
          enabled: true,
          connectionState: 'connected',
          errorMessage: 'Some error'
        }
      };
      const host = Host.fromConfig(config);
      
      host.disableInterfaceGateway();
      
      expect(host.interfaceGateway.enabled).toBe(false);
      expect(host.interfaceGateway.connectionState).toBe('disconnected');
      expect(host.interfaceGateway.errorMessage).toBeUndefined();
    });

    test('updateInterfaceGatewayState updates state correctly', () => {
      const config = createValidHostConfig();
      const host = Host.fromConfig(config);
      
      host.updateInterfaceGatewayState('error', 'Connection timeout');
      
      expect(host.interfaceGateway.connectionState).toBe('error');
      expect(host.interfaceGateway.errorMessage).toBe('Connection timeout');
    });

    test('updateInterfaceGatewayState clears error message when undefined', () => {
      const config = {
        ...createValidHostConfig(),
        interfaceGateway: {
          port: 51515,
          enabled: true,
          connectionState: 'error',
          errorMessage: 'Previous error'
        }
      };
      const host = Host.fromConfig(config);
      
      host.updateInterfaceGatewayState('connected');
      
      expect(host.interfaceGateway.connectionState).toBe('connected');
      expect(host.interfaceGateway.errorMessage).toBeUndefined();
    });
  });

  describe('host management', () => {
    test('enable sets host to enabled', () => {
      const config = { ...createValidHostConfig(), enabled: false };
      const host = Host.fromConfig(config);
      
      host.enable();
      
      expect(host.enabled).toBe(true);
    });

    test('disable sets host to disabled and disables interface gateway', () => {
      const config = {
        ...createValidHostConfig(),
        interfaceGateway: {
          port: 51515,
          enabled: true,
          connectionState: 'connected'
        }
      };
      const host = Host.fromConfig(config);
      
      host.disable();
      
      expect(host.enabled).toBe(false);
      expect(host.interfaceGateway.enabled).toBe(false);
      expect(host.interfaceGateway.connectionState).toBe('disconnected');
    });
  });

  describe('toClientObject', () => {
    test('returns client-friendly object representation', () => {
      const config = {
        sim: 'client-sim',
        host: '10.0.0.1',
        channel: 'Client Channel',
        enabled: true,
        port: 7777,
        interfaceGateway: {
          port: 53535,
          enabled: true,
          connectionState: 'connected',
          errorMessage: null
        }
      };
      const host = Host.fromConfig(config);
      const clientObj = host.toClientObject();
      
      expect(clientObj).toEqual({
        sim: 'client-sim',
        host: '10.0.0.1',
        channel: 'Client Channel',
        enabled: true,
        port: 7777,
        interfaceGateway: {
          port: 53535,
          enabled: true,
          connectionState: 'connected',
          errorMessage: null
        }
      });
    });
  });

  describe('withUpdates', () => {
    test('creates new host with basic updates', () => {
      const config = createValidHostConfig();
      const host = Host.fromConfig(config);
      
      const updatedHost = host.withUpdates({
        host: '192.168.1.50',
        channel: 'Updated Channel'
      });
      
      expect(updatedHost).not.toBe(host); // Different instance
      expect(updatedHost.sim).toBe('test-sim'); // Unchanged
      expect(updatedHost.host).toBe('192.168.1.50'); // Updated
      expect(updatedHost.channel).toBe('Updated Channel'); // Updated
      expect(updatedHost.interfaceGateway.port).toBe(51515); // Unchanged
    });

    test('creates new host with interface gateway updates', () => {
      const config = createValidHostConfig();
      const host = Host.fromConfig(config);
      
      const updatedHost = host.withUpdates({
        interfaceGateway: {
          enabled: true,
          connectionState: 'connected'
        }
      });
      
      expect(updatedHost).not.toBe(host);
      expect(updatedHost.interfaceGateway.port).toBe(51515); // Preserved
      expect(updatedHost.interfaceGateway.enabled).toBe(true); // Updated
      expect(updatedHost.interfaceGateway.connectionState).toBe('connected'); // Updated
    });

    test('creates new host with nested interface gateway port update', () => {
      const config = createValidHostConfig();
      const host = Host.fromConfig(config);
      
      const updatedHost = host.withUpdates({
        interfaceGateway: {
          port: 54545
        }
      });
      
      expect(updatedHost.interfaceGateway.port).toBe(54545);
      expect(updatedHost.interfaceGateway.enabled).toBe(false); // Preserved
    });
  });

  describe('isEquivalentTo', () => {
    test('returns true for equivalent hosts', () => {
      const config = createValidHostConfig();
      const host1 = Host.fromConfig(config);
      const host2 = Host.fromConfig(config);
      
      expect(host1.isEquivalentTo(host2)).toBe(true);
    });

    test('returns true when comparing host to config object', () => {
      const config = createValidHostConfig();
      const host = Host.fromConfig(config);
      const normalizedConfig = host.toConfig(); // Use normalized config that includes defaults
      
      expect(host.isEquivalentTo(normalizedConfig)).toBe(true);
    });

    test('returns false for different hosts', () => {
      const config1 = createValidHostConfig();
      const config2 = { ...createValidHostConfig(), sim: 'different-sim' };
      const host1 = Host.fromConfig(config1);
      const host2 = Host.fromConfig(config2);
      
      expect(host1.isEquivalentTo(host2)).toBe(false);
    });

    test('returns false for hosts with different interface gateway settings', () => {
      const config1 = createValidHostConfig();
      const config2 = {
        ...createValidHostConfig(),
        interfaceGateway: { port: 52525, enabled: true }
      };
      const host1 = Host.fromConfig(config1);
      const host2 = Host.fromConfig(config2);
      
      expect(host1.isEquivalentTo(host2)).toBe(false);
    });
  });

  describe('edge cases and error handling', () => {
    test('handles undefined values gracefully in toConfig', () => {
      const ig = new InterfaceGateway(51515);
      const host = new Host('test-sim', 'localhost', 8080, 'Test Channel', ig);
      const config = host.toConfig();
      
      expect(config.port).toBe(8080);
      expect(config).toHaveProperty('port');
    });

    test('validates interface gateway type', () => {
      const host = new Host('test-sim', 'localhost', 8080, 'Test Channel', null);
      
      expect(() => host.validate()).toThrow('Host must have a valid InterfaceGateway instance');
    });

    test('validates enabled field type when provided', () => {
      // This test verifies the validate() method catches type errors
      // Since fromConfig doesn't validate optional field types, we create a valid host and then modify it
      const config = createValidHostConfig();
      const host = Host.fromConfig(config);
      
      // Directly modify the property to simulate invalid data
      Object.defineProperty(host, 'enabled', { value: 'invalid-boolean', writable: true, configurable: true });
      
      expect(() => host.validate()).toThrow('Host enabled field must be a boolean if provided');
    });

    test('fromConfig handles missing port in interface gateway', () => {
      const config = {
        sim: 'test-sim',
        host: 'localhost',
        port: 8080,
        channel: 'Test Channel',
        interfaceGateway: {
          enabled: false
          // missing port
        }
      };
      
      // fromConfig will succeed but validation will fail
      const host = Host.fromConfig(config);
      expect(() => host.validate()).toThrow('InterfaceGateway port must be a valid port number (1-65535)');
    });
  });

  describe('integration scenarios', () => {
    test('complete host lifecycle simulation', () => {
      // Create a new host
      const config = createValidHostConfig();
      const host = Host.fromConfig(config);
      
      // Validate initial state
      expect(host.enabled).toBe(true);
      expect(host.interfaceGateway.enabled).toBe(false);
      expect(host.isActive()).toBe(true);
      
      // Enable interface gateway
      host.enableInterfaceGateway();
      expect(host.interfaceGateway.enabled).toBe(true);
      expect(host.interfaceGateway.connectionState).toBe('connecting');
      
      // Simulate successful connection
      host.updateInterfaceGatewayState('connected');
      expect(host.interfaceGateway.connectionState).toBe('connected');
      expect(host.interfaceGateway.errorMessage).toBeUndefined();
      
      // Simulate connection error
      host.updateInterfaceGatewayState('error', 'Network timeout');
      expect(host.interfaceGateway.connectionState).toBe('error');
      expect(host.interfaceGateway.errorMessage).toBe('Network timeout');
      
      // Disable host (should also disable interface gateway)
      host.disable();
      expect(host.enabled).toBe(false);
      expect(host.interfaceGateway.enabled).toBe(false);
      expect(host.interfaceGateway.connectionState).toBe('disconnected');
      expect(host.isActive()).toBe(false);
    });

    test('configuration serialization round-trip', () => {
      const originalConfig = {
        sim: 'roundtrip-sim',
        host: '172.16.0.1',
        channel: 'Roundtrip Channel',
        enabled: false,
        port: 9999,
        interfaceGateway: {
          port: 55555,
          enabled: true,
          connectionState: 'error',
          errorMessage: 'Test error message'
        }
      };
      
      // Config -> Host -> Config
      const host = Host.fromConfig(originalConfig);
      const serializedConfig = host.toConfig();
      
      // Serialized config should have IG enabled set to false for server restart behavior
      const expectedSerializedConfig = {
        ...originalConfig,
        interfaceGateway: {
          ...originalConfig.interfaceGateway,
          enabled: false
        }
      };
      
      expect(serializedConfig).toEqual(expectedSerializedConfig);
      
      // Ensure we can create another host from the serialized config
      const recreatedHost = Host.fromConfig(serializedConfig);
      // The recreated host will have IG disabled due to serialization behavior
      expect(recreatedHost.sim).toBe(host.sim);
      expect(recreatedHost.host).toBe(host.host);
      expect(recreatedHost.port).toBe(host.port);
      expect(recreatedHost.channel).toBe(host.channel);
      expect(recreatedHost.enabled).toBe(host.enabled);
      expect(recreatedHost.interfaceGateway.port).toBe(host.interfaceGateway.port);
      expect(recreatedHost.interfaceGateway.enabled).toBe(false); // Always false after serialization
    });
  });

  describe('authentication', () => {
    test('InterfaceGateway should not have authentication by default', () => {
      const ig = new InterfaceGateway(8080);
      
      expect(ig.hasAuthentication()).toBe(false);
      expect(ig.username).toBeUndefined();
      expect(ig.encryptedPassword).toBeUndefined();
    });

    test('setAuthentication should encrypt password and store username', () => {
      const ig = new InterfaceGateway(8080);
      
      ig.setAuthentication('testuser', 'plainpassword');
      
      expect(ig.hasAuthentication()).toBe(true);
      expect(ig.username).toBe('testuser');
      expect(ig.encryptedPassword).toBeDefined();
      expect(ig.encryptedPassword).not.toBe('plainpassword'); // Should be encrypted
      expect(ig.encryptedPassword).toMatch(/^[A-Za-z0-9+/]+=*:[A-Za-z0-9+/]+=*$/); // IV:encrypted format
    });

    test('getDecryptedPassword should return original password', () => {
      const ig = new InterfaceGateway(8080);
      const originalPassword = 'mySecretPassword123';
      
      ig.setAuthentication('testuser', originalPassword);
      const decryptedPassword = ig.getDecryptedPassword();
      
      expect(decryptedPassword).toBe(originalPassword);
    });

    test('authentication can be cleared by setting to undefined', () => {
      const ig = new InterfaceGateway(8080);
      
      ig.setAuthentication('testuser', 'password');
      expect(ig.hasAuthentication()).toBe(true);
      
      ig.setAuthentication(undefined, undefined);
      expect(ig.hasAuthentication()).toBe(false);
      expect(ig.username).toBeUndefined();
      expect(ig.encryptedPassword).toBeUndefined();
    });

    test('Host toClientObject should exclude password but include username', () => {
      const host = new Host(
        'test-sim',
        'localhost', 
        8080,
        'test-channel',
        new InterfaceGateway(55555)
      );
      
      host.interfaceGateway.setAuthentication('testuser', 'secretpassword');
      
      const clientObj = host.toClientObject();
      
      expect(clientObj.interfaceGateway.username).toBe('testuser');
      expect(clientObj.interfaceGateway.hasPassword).toBe(true);
      expect(clientObj.interfaceGateway.encryptedPassword).toBeUndefined();
      expect(clientObj.interfaceGateway.password).toBeUndefined();
    });

    test('toConfig should include encrypted password for persistence', () => {
      const ig = new InterfaceGateway(8080);
      ig.setAuthentication('testuser', 'secretpassword');
      
      const config = ig.toConfig();
      
      expect(config.username).toBe('testuser');
      expect(config.encryptedPassword).toBeDefined();
      expect(config.encryptedPassword).toMatch(/^[A-Za-z0-9+/]+=*:[A-Za-z0-9+/]+=*$/); // IV:encrypted format
      expect(config.password).toBeUndefined(); // Plain password should never be in config
    });

    test('fromConfig should restore authentication from encrypted data', () => {
      const ig1 = new InterfaceGateway(8080);
      ig1.setAuthentication('testuser', 'mypassword');
      
      // Save to config and recreate
      const config = ig1.toConfig();
      const ig2 = InterfaceGateway.fromConfig(config);
      
      expect(ig2.hasAuthentication()).toBe(true);
      expect(ig2.username).toBe('testuser');
      expect(ig2.encryptedPassword).toBe(ig1.encryptedPassword);
      expect(ig2.getDecryptedPassword()).toBe('mypassword');
    });

    test('Host authentication should be preserved through Host.fromConfig with encrypted password', () => {
      // First create a host with authentication
      const host1 = new Host(
        'test-sim',
        'localhost',
        8080,
        'test-channel',
        new InterfaceGateway(55555)
      );
      host1.interfaceGateway.setAuthentication('hostuser', 'hostpassword');
      
      // Convert to config (this will include the encrypted password)
      const config = host1.toConfig();
      
      // Create new host from config
      const host2 = Host.fromConfig(config);
      
      expect(host2.interfaceGateway.hasAuthentication()).toBe(true);
      expect(host2.interfaceGateway.username).toBe('hostuser');
      expect(host2.interfaceGateway.getDecryptedPassword()).toBe('hostpassword');
    });
  });
});
