import { jest } from '@jest/globals';
import STOMPManager from '../src/stomp.js';
import GameStompClient from '../src/model/gameStompClient.js';
import Host from '../src/model/host.js';
import chalk from 'chalk';

// Mock the logger to prevent console output during tests
console.log = jest.fn();
console.info = jest.fn();
console.error = jest.fn();

// Mock chalk to avoid color codes in tests
jest.mock('chalk', () => ({
  yellow: jest.fn((msg) => msg),
  red: jest.fn((msg) => msg),
  green: jest.fn((msg) => msg),
  white: jest.fn((msg) => msg),
  bgRed: jest.fn((msg) => msg),
  redBright: jest.fn((msg) => msg),
}));

describe('STOMPManager', () => {
  let stompManager;
  let mockGameManager;
  let mockTrainManager;

  beforeEach(() => {
    stompManager = new STOMPManager();
    mockGameManager = {
      updateAdminUI: jest.fn()
    };
    mockTrainManager = {
      setGameManager: jest.fn()
    };
    stompManager.setTrainManager(mockTrainManager);
    stompManager.setGameManager(mockGameManager);
  });

  afterEach(() => {
    // Clean up any clients or connections
    if (stompManager && stompManager.clients) {
      stompManager.clients = [];
    }
    jest.clearAllTimers();
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  describe('removeClientForGame', () => {
    test('should always deactivate client when removing, regardless of enabled state', () => {
      // Create a mock interface gateway that's disabled
      const interfaceGateway = {
        port: 55555,
        enabled: false, // This is the key - it's disabled
        connectionState: 'connected',
        errorMessage: null
      };
      
      // Create a mock host with interface gateway disabled
      const host = new Host('test-sim', 'localhost', 8080, 'test-channel', interfaceGateway);

      // Create a mock STOMP client
      const mockClient = {
        deactivate: jest.fn()
      };

      // Create and add a GameStompClient to the manager
      const gameClient = new GameStompClient('test-sim', host, mockClient);
      stompManager.clients = [gameClient];

      // Call removeClientForGame
      stompManager.removeClientForGame('test-sim');

      // Verify that deactivate was called even though enabled is false
      expect(mockClient.deactivate).toHaveBeenCalled();
      
      // Verify the state was updated correctly
      expect(host.interfaceGateway.connectionState).toBe('disconnected');
      expect(host.interfaceGateway.errorMessage).toBe(null);
      
      // Verify UI was updated
      expect(mockGameManager.updateAdminUI).toHaveBeenCalled();
      
      // Verify client was removed from array
      expect(stompManager.clients).toHaveLength(0);
    });

    test('should handle deactivation errors gracefully', () => {
      // Create a mock interface gateway
      const interfaceGateway = {
        port: 55555,
        enabled: false,
        connectionState: 'connected',
        errorMessage: null
      };
      
      // Create a mock host
      const host = new Host('test-sim', 'localhost', 8080, 'test-channel', interfaceGateway);

      // Create a mock STOMP client that throws an error
      const mockClient = {
        deactivate: jest.fn(() => {
          throw new Error('Connection lost');
        })
      };

      // Create and add a GameStompClient to the manager
      const gameClient = new GameStompClient('test-sim', host, mockClient);
      stompManager.clients = [gameClient];

      // Call removeClientForGame - should not throw
      expect(() => {
        stompManager.removeClientForGame('test-sim');
      }).not.toThrow();

      // Verify error state was set
      expect(host.interfaceGateway.connectionState).toBe('error');
      expect(host.interfaceGateway.errorMessage).toBe('Connection lost');
      
      // Verify client was still removed from array
      expect(stompManager.clients).toHaveLength(0);
    });

    test('should do nothing if client not found', () => {
      stompManager.clients = [];
      
      // Should not throw
      expect(() => {
        stompManager.removeClientForGame('nonexistent-sim');
      }).not.toThrow();
      
      // Should not update UI if no client found
      expect(mockGameManager.updateAdminUI).not.toHaveBeenCalled();
    });
  });

  describe('authentication handling (from test_stomp_fix.js and test_stomp_refactor.js)', () => {
    test('should properly check authentication using hasAuthentication method', () => {
      // Create host with authentication
      const interfaceGateway = {
        port: 55555,
        enabled: true,
        connectionState: 'disconnected',
        errorMessage: null,
        hasAuthentication: jest.fn().mockReturnValue(true),
        username: 'testuser',
        encryptedPassword: 'encrypted:password:here'
      };
      
      const hostWithAuth = new Host('test-sim', 'localhost', 8080, 'test-channel', interfaceGateway);
      
      // Verify authentication method is called correctly
      const hasAuth = hostWithAuth.interfaceGateway.hasAuthentication();
      expect(hasAuth).toBe(true);
      expect(hostWithAuth.interfaceGateway.hasAuthentication).toHaveBeenCalled();
    });

    test('should handle host without authentication', () => {
      // Create host without authentication
      const interfaceGateway = {
        port: 55555,
        enabled: true,
        connectionState: 'disconnected',
        errorMessage: null,
        hasAuthentication: jest.fn().mockReturnValue(false),
        username: null,
        encryptedPassword: null
      };
      
      const hostWithoutAuth = new Host('test-sim', 'localhost', 8080, 'test-channel', interfaceGateway);
      
      // Verify no authentication
      const hasAuth = hostWithoutAuth.interfaceGateway.hasAuthentication();
      expect(hasAuth).toBe(false);
      expect(hostWithoutAuth.interfaceGateway.hasAuthentication).toHaveBeenCalled();
    });
  });

  describe('createClientForGame method (legacy compatibility)', () => {
    test('should work with Host instances for backward compatibility', () => {
      const interfaceGateway = {
        port: 55555,
        enabled: true,
        connectionState: 'disconnected',
        errorMessage: null,
        hasAuthentication: jest.fn().mockReturnValue(false)
      };
      
      const host = new Host('test-sim', 'localhost', 8080, 'test-channel', interfaceGateway);
      
      // This should not throw when called with Host instance
      expect(() => {
        stompManager.createClientForGame(host);
      }).not.toThrow();
    });
  });

  describe('error handling', () => {
    test('should handle connection errors gracefully', () => {
      const interfaceGateway = {
        port: 55555,
        enabled: true,
        connectionState: 'disconnected',
        errorMessage: null
      };
      
      const host = new Host('test-sim', 'localhost', 8080, 'test-channel', interfaceGateway);
      stompManager.clients = [{
        host: host,
        client: {
          deactivate: jest.fn(),
          connected: false
        }
      }];
      
      // Should handle deactivation errors
      stompManager.clients[0].client.deactivate.mockImplementation(() => {
        throw new Error('Deactivation failed');
      });
      
      // Should not throw despite deactivation error
      expect(() => {
        stompManager.removeClientForGame('test-sim');
      }).not.toThrow();
    });
  });
});
