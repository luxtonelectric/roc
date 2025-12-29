// @ts-nocheck
import { jest } from '@jest/globals';
import ROCManager from '../src/ROCManager.js';
import Player from '../src/model/player.js';
import Simulation from '../src/model/simulation.js';
import Phone from '../src/model/phone.js';
import Host from '../src/model/host.js';

// Mock dependencies
// @ts-ignore
class MockPhoneManager {
  phones = [];
  sims = [];
  
  unassignPhone(phone) { return true; }
  getPhonesForDiscordId() { return []; }
  getSpeedDialForPhone() { return []; }
  getTrainsAndMobilesForPhone() { return []; }
  generatePhonesForSim() { return []; }
  generatePhoneForTrain() { return new Phone('1', 'Test Phone', 'mobile'); }
  generatePhoneForPerson() { return new Phone('1', 'Test Phone', 'mobile'); }
  generatePhonesForTrains() { return []; }
  generateMissingNeighbourPhones() {}
  generatePhoneAssignments() {}
  generatePhoneForPanel() { return new Phone('1', 'Test Phone', 'fixed'); }
  getRECRecipientsForPhone() { return []; }
  sendPhonebookUpdateToPlayer() {}
  getPhone() { return null; }
  getAllPhones() { return []; }
  assignPhone() { return true; }
  unassignPhonesForDiscordId() {}
}

// @ts-ignore
class MockSocket {
  emit() {}
  join() {}
  disconnected = false;
  get id() { return 'mock-socket-id'; }
}

// @ts-ignore
class MockCallManager {
  privateCalls = {};
  groupCallManager = {
    getAllActiveGroupCalls() { return []; }
  };
}

// @ts-ignore
class MockDiscordBot {
  gameManager = null;
  privateCallChannels = [];
  client = null;
  token = '';
  prefix = '!';
  guildId = 'test-guild';
  
  getMember() { return Promise.resolve({ displayAvatarURL: () => '', displayName: '' }); }
  getUserVoiceChannel() { return Promise.resolve(null); }
  setUserVoiceChannel() { return Promise.resolve(true); }
  setGameManager(gm) { this.gameManager = gm; }
  setUpBot() { return Promise.resolve(); }
  configureVoiceChannels() { return Promise.resolve(); }
  connectToVoice() { return Promise.resolve(); }
  disconnectFromVoice() { return Promise.resolve(); }
  checkVoiceConnected() { return Promise.resolve(); }
  updateVoice() {}
  checkAllConnected() { return Promise.resolve(true); }
  getVoiceChannelByName() { return null; }
  getVoiceChannelById() { return null; }
  getAvailableCallChannel() { return null; }
  releasePrivateCallChannelReservation() {}
}

// @ts-ignore
class MockSTOMPManager {
  gameManager = null;
  phoneManager = null;
  clients = [];
  trainManager = null;
  
  setGameManager() {}
  createClientForHost() { return true; }
  activateClientForGame() { return true; }
  deactivateClientForGame() { return true; }
  removeClientForGame() { return true; }
  setTrainManager() {}
}

// @ts-ignore
class MockServer {
  emit = jest.fn();
  to = jest.fn(() => ({ emit: jest.fn() }));
  sockets = {};
  engine = {};
  httpServer = {};
  _parser = {};
  // Add minimum required properties to satisfy TS
}

// @ts-ignore  
class MockSimulationLoader {
  loadSimulation() { return null; }
  getSimulationMetadata() { return null; }
  getAvailableSimulations() { return Promise.resolve([]); }
}

// @ts-ignore
class MockConfigurationManager {
  #cachedConfig = null;
  
  saveConfig() { return Promise.resolve(); }
  loadConfig() { return Promise.resolve({}); }
  getCachedConfig() { return this.#cachedConfig; }
  setCachedConfig(config) { this.#cachedConfig = config; }
}

describe('ROCManager.releasePanel', () => {
  let rocManager;
  let mockSocket;
  let mockPhoneManager;
  let mockDiscordBot;
  let mockSTOMPManager;
  let mockIo;
  let mockConfig;

  beforeEach(() => {
    mockSocket = new MockSocket();
    mockPhoneManager = new MockPhoneManager();
    mockDiscordBot = new MockDiscordBot();
    mockSTOMPManager = new MockSTOMPManager();
    mockIo = new MockServer();
    mockIo.emit = jest.fn();

    // Mock config object based on config.json.example structure
    mockConfig = {
      games: [{
        sim: 'test-sim',
        channel: 'test-channel',
        host: 'localhost',
        interfaceGateway: {
          port: 51515,
          enabled: true
        }
      }],
      server: { port: 8080 },
      corsOrigin: 'http://localhost:3000',
      token: 'test-token',
      prefix: 'test-prefix',
      guild: 'test-guild',
      channels: {
        afk: 'test-afk',
        lobby: 'test-lobby'
      }
    };

    // Create ROCManager instance with mocked dependencies
    rocManager = new ROCManager(mockIo, mockDiscordBot, mockPhoneManager, mockSTOMPManager, new MockCallManager());
    rocManager.config = mockConfig;
    
    // Setup test player
    const testPlayer = new Player(mockSocket, 'test-user', 'test-channel');
    rocManager.users['test-user'] = testPlayer;

    // Setup test simulation
    const testSim = Simulation.fromSimData('test-sim', {
      id: 'test-sim',
      name: 'Test Simulation',
      panels: [{
        id: 'test-panel',
        name: 'Test Panel',
        neighbours: []
      }]
    });
    testSim.panels[0].player = 'test-user';
    testSim.panels[0].phone = new Phone('1', 'Test Phone', 'fixed');
    rocManager.sims = [testSim];

    // Spy on key methods
    jest.spyOn(mockPhoneManager, 'unassignPhone');
    jest.spyOn(mockSocket, 'emit');
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('successfully releases a panel', () => {
    // Execute
    rocManager.releasePanel('test-user', 'test-sim', 'test-panel');

    // Verify panel is released
    const panel = rocManager.sims[0].panels[0];
    expect(panel.player).toBeUndefined();

    // Verify phone is unassigned
    expect(mockPhoneManager.unassignPhone).toHaveBeenCalledWith(panel.phone);

    // Verify game updates are sent
    expect(mockIo.emit).toHaveBeenCalledWith('gameInfo', expect.anything());
  });

  test('returns false when player is not found', () => {
    const result = rocManager.releasePanel('non-existent-user', 'test-sim', 'test-panel');
    expect(result).toBe(false);
    expect(mockPhoneManager.unassignPhone).not.toHaveBeenCalled();
  });

  test('returns false when simulation is not found', () => {
    const result = rocManager.releasePanel('test-user', 'non-existent-sim', 'test-panel');
    expect(result).toBe(false);
    expect(mockPhoneManager.unassignPhone).not.toHaveBeenCalled();
  });

  test('returns false when panel is not found', () => {
    const result = rocManager.releasePanel('test-user', 'test-sim', 'non-existent-panel');
    expect(result).toBe(false);
    expect(mockPhoneManager.unassignPhone).not.toHaveBeenCalled();
  });

  test('updates player info after releasing panel', () => {
    // Spy on updateUserInfo method
    jest.spyOn(rocManager, 'updateUserInfo');

    // Execute
    rocManager.releasePanel('test-user', 'test-sim', 'test-panel');

    // Verify user info is updated
    expect(rocManager.updateUserInfo).toHaveBeenCalledWith(rocManager.users['test-user']);
  });
});

describe('ROCManager Host Integration', () => {
  let rocManager;
  let mockPhoneManager;
  let mockBot;
  let mockStompManager;
  let mockSimulationLoader;
  let mockConfigurationManager;
  let mockIo;
  
  beforeEach(() => {
    mockPhoneManager = new MockPhoneManager();
    mockBot = new MockDiscordBot();
    mockStompManager = new MockSTOMPManager();
    mockSimulationLoader = new MockSimulationLoader();
    mockConfigurationManager = new MockConfigurationManager();
    mockIo = { emit: jest.fn(), to: jest.fn().mockReturnValue({ emit: jest.fn() }) };
    
    rocManager = new ROCManager(
      mockIo,
      mockBot,
      mockPhoneManager,
      mockStompManager,
      mockSimulationLoader,
      mockConfigurationManager
    );
  });
  
  test('load method creates Host instances from config', () => {
    const config = {
      channels: { lobby: 'test-lobby', afk: 'test-afk' },
      games: [
        {
          sim: 'test-sim',
          host: 'localhost',
          port: 8080,
          channel: 'test-channel',
          enabled: true,
          interfaceGateway: { port: 8080, enabled: false }
        }
      ]
    };
    
    mockConfigurationManager.setCachedConfig(config);
    rocManager.load();
    
    expect(rocManager.hosts).toHaveLength(1);
    expect(rocManager.hosts[0].sim).toBe('test-sim');
    expect(rocManager.hosts[0].host).toBe('localhost');
    expect(rocManager.hosts[0].channel).toBe('test-channel');
    expect(rocManager.hosts[0].enabled).toBe(true);
    expect(rocManager.hosts[0].interfaceGateway.port).toBe(8080);
    expect(rocManager.hosts[0].interfaceGateway.enabled).toBe(false);
  });

  test('load method resets Interface Gateway enabled state on server restart', () => {
    const config = {
      channels: { lobby: 'test-lobby', afk: 'test-afk' },
      games: [
        {
          sim: 'test-sim',
          host: 'localhost',
          port: 8080,
          channel: 'test-channel',
          enabled: true,
          interfaceGateway: { 
            port: 8080, 
            enabled: true, // This should be reset to false
            connectionState: 'connected',
            errorMessage: 'Previous error'
          }
        }
      ]
    };
    
    mockConfigurationManager.setCachedConfig(config);
    rocManager.load();
    
    expect(rocManager.hosts).toHaveLength(1);
    expect(rocManager.hosts[0].interfaceGateway.enabled).toBe(false); // Always disabled on load
    expect(rocManager.hosts[0].interfaceGateway.connectionState).toBe('disconnected'); // Reset state
    expect(rocManager.hosts[0].interfaceGateway.errorMessage).toBeUndefined(); // Clear errors
  });
  
  test('getHostById returns correct host', () => {
    const config = {
      channels: { lobby: 'test-lobby', afk: 'test-afk' },
      games: [
        {
          sim: 'test-sim-1',
          host: 'localhost',
          port: 8080,
          channel: 'test-channel',
          enabled: true,
          interfaceGateway: { port: 8080, enabled: false }
        },
        {
          sim: 'test-sim-2',
          host: 'localhost',
          port: 8081,
          channel: 'test-channel-2',
          enabled: true,
          interfaceGateway: { port: 8081, enabled: false }
        }
      ]
    };
    
    mockConfigurationManager.setCachedConfig(config);
    rocManager.load();
    
    const host = rocManager.getHostById('test-sim-2');
    expect(host).toBeDefined();
    expect(host.sim).toBe('test-sim-2');
    expect(host.channel).toBe('test-channel-2');
    expect(host.interfaceGateway.port).toBe(8081);
  });
  
  test('getHostState returns client objects', () => {
    const config = {
      channels: { lobby: 'test-lobby', afk: 'test-afk' },
      games: [
        {
          sim: 'test-sim',
          host: 'localhost',
          port: 8080,
          channel: 'test-channel',
          enabled: true,
          interfaceGateway: { port: 8080, enabled: false }
        }
      ]
    };
    
    mockConfigurationManager.setCachedConfig(config);
    rocManager.load();
    
    const hostState = rocManager.getHostState();
    expect(hostState).toHaveLength(1);
    expect(hostState[0].sim).toBe('test-sim');
    expect(hostState[0].host).toBe('localhost');
    expect(hostState[0].channel).toBe('test-channel');
    expect(hostState[0].enabled).toBe(true);
    expect(hostState[0].interfaceGateway.port).toBe(8080);
    expect(hostState[0].interfaceGateway.enabled).toBe(false);
  });
});

describe('ROCManager.addHost', () => {
  let rocManager;
  let mockPhoneManager;
  let mockBot;
  let mockStompManager;
  let mockSimulationLoader;
  let mockConfigurationManager;
  let mockIo;
  
  beforeEach(() => {
    mockPhoneManager = new MockPhoneManager();
    mockBot = new MockDiscordBot();
    mockStompManager = new MockSTOMPManager();
    mockSimulationLoader = new MockSimulationLoader();
    mockConfigurationManager = new MockConfigurationManager();
    mockIo = { emit: jest.fn(), to: jest.fn().mockReturnValue({ emit: jest.fn() }) };
    
    rocManager = new ROCManager(
      mockIo,
      mockBot,
      mockPhoneManager,
      mockStompManager,
      mockSimulationLoader,
      mockConfigurationManager
    );
    
    // Initialize with a basic config to avoid null reference errors
    rocManager.config = {
      channels: { lobby: 'test-lobby', afk: 'test-afk' },
      games: []
    };
    
    // Mock simulation loading to return a valid simulation
    jest.spyOn(rocManager, 'getSimData').mockImplementation(() => ({
      id: 'test-sim',
      name: 'Test Simulation',
      panels: []
    }));
    
    // Mock other methods to avoid side effects
    jest.spyOn(rocManager, 'activateGame').mockImplementation(jest.fn());
    jest.spyOn(rocManager, 'saveConfig').mockResolvedValue();
    jest.spyOn(rocManager, 'sendGameUpdateToPlayers').mockImplementation(jest.fn());
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('should add a single host successfully', async () => {
    // Setup: Empty hosts array
    rocManager.hosts = [];
    
    const hostConfig = {
      sim: 'kingsx',
      host: 'localhost',
      port: 8080,
      channel: 'kingsx-channel',
      enabled: true,
      interfaceGateway: { port: 51515, enabled: false }
    };
    
    // Execute
    await rocManager.addHost(hostConfig);
    
    // Verify
    expect(rocManager.hosts).toHaveLength(1);
    expect(rocManager.hosts[0].sim).toBe('kingsx');
    expect(rocManager.saveConfig).toHaveBeenCalled();
    expect(rocManager.activateGame).toHaveBeenCalled();
  });

  test('should reject adding a second host with the same simulation ID', async () => {
    // Setup: Add first host
    rocManager.hosts = [];
    
    const firstHostConfig = {
      sim: 'kingsx',
      host: 'host1.example.com',
      port: 8080,
      channel: 'kingsx-channel-1',
      enabled: true,
      interfaceGateway: { port: 51515, enabled: false }
    };
    
    const secondHostConfig = {
      sim: 'kingsx',  // Same simulation ID
      host: 'host2.example.com',
      port: 8081,
      channel: 'kingsx-channel-2',
      enabled: true,
      interfaceGateway: { port: 51516, enabled: false }
    };
    
    // Add first host successfully
    await rocManager.addHost(firstHostConfig);
    expect(rocManager.hosts).toHaveLength(1);
    
    // Try to add second host with same sim ID
    // Current implementation doesn't check for duplicates, so it will succeed
    // But it SHOULD fail - this test will currently fail and should pass after fix
    let errorThrown = false;
    try {
      await rocManager.addHost(secondHostConfig);
    } catch (error) {
      errorThrown = true;
      expect(error.message).toMatch(/simulation.*already.*exists|duplicate.*simulation|only.*one.*host.*per.*simulation/i);
    }
    
    // The current implementation will allow both hosts, but it shouldn't
    // This assertion tests the constraint: only one host per simulation should exist
    if (!errorThrown) {
      // If no error was thrown, then the implementation is broken 
      // because it allowed duplicate simulation IDs
      expect(rocManager.hosts.filter(h => h.sim === 'kingsx')).toHaveLength(1);
    }
    
    // This assertion will fail with current implementation and demonstrate the bug
    expect(rocManager.hosts).toHaveLength(1);
  });

  test('should allow adding hosts with different simulation IDs', async () => {
    // Setup: Empty hosts array
    rocManager.hosts = [];
    
    const kingsxConfig = {
      sim: 'kingsx',
      host: 'host1.example.com',
      port: 8080,
      channel: 'kingsx-channel',
      enabled: true,
      interfaceGateway: { port: 51515, enabled: false }
    };
    
    const bristolConfig = {
      sim: 'bristol',  // Different simulation ID
      host: 'host2.example.com',
      port: 8081,
      channel: 'bristol-channel',
      enabled: true,
      interfaceGateway: { port: 51516, enabled: false }
    };
    
    // Add both hosts
    await rocManager.addHost(kingsxConfig);
    await rocManager.addHost(bristolConfig);
    
    // Verify both were added
    expect(rocManager.hosts).toHaveLength(2);
    expect(rocManager.hosts.find(h => h.sim === 'kingsx')).toBeDefined();
    expect(rocManager.hosts.find(h => h.sim === 'bristol')).toBeDefined();
  });

  test('should create new host as disabled by default', async () => {
    // Setup: Empty hosts array
    rocManager.hosts = [];
    
    const hostConfig = {
      sim: 'kingsx',
      host: 'localhost',
      port: 8080,
      channel: 'kingsx-channel',
      enabled: true, // Even if enabled is set to true in config
      interfaceGateway: { port: 51515, enabled: false }
    };
    
    // Execute
    await rocManager.addHost(hostConfig);
    
    // Verify host was added but is disabled
    expect(rocManager.hosts).toHaveLength(1);
    const addedHost = rocManager.hosts[0];
    expect(addedHost.sim).toBe('kingsx');
    
    // This is the key assertion: new hosts should be disabled by default
    expect(addedHost.enabled).toBe(false);
  });

  test('should detect existing host with same sim ID in current configuration', async () => {
    // Setup: Pre-load configuration with existing host
    const config = {
      channels: { lobby: 'test-lobby', afk: 'test-afk' },
      games: [{
        sim: 'kingsx',
        host: 'existing-host.example.com',
        port: 8080,
        channel: 'existing-channel',
        enabled: false,
        interfaceGateway: { port: 51515, enabled: false }
      }]
    };
    
    mockConfigurationManager.setCachedConfig(config);
    rocManager.load();
    expect(rocManager.hosts).toHaveLength(1);
    
    // Try to add another host with same sim ID
    const conflictingHostConfig = {
      sim: 'kingsx',  // Same as existing
      host: 'new-host.example.com',
      port: 8081,
      channel: 'new-channel',
      enabled: true,
      interfaceGateway: { port: 51516, enabled: false }
    };
    
    // Current implementation will allow this, but it shouldn't
    let errorThrown = false;
    try {
      await rocManager.addHost(conflictingHostConfig);
    } catch (error) {
      errorThrown = true;
      expect(error.message).toMatch(/simulation.*already.*exists|duplicate.*simulation|only.*one.*host.*per.*simulation/i);
    }
    
    // The key constraint: should not have more than one host with same sim ID
    const kingsxHosts = rocManager.hosts.filter(h => h.sim === 'kingsx');
    
    // This assertion will fail with current implementation - it should only be 1
    expect(kingsxHosts).toHaveLength(1);
    
    if (!errorThrown) {
      // If no error was thrown, verify the implementation is broken by allowing duplicates
      // This will fail and show the current bug
      expect(rocManager.hosts).toHaveLength(1); // Should still be 1, but will be 2
      expect(rocManager.hosts[0].host).toBe('existing-host.example.com');
    }
  });

  describe('authentication handling', () => {
    test('should encrypt password when creating host with authentication', async () => {
      rocManager.hosts = [];
      
      const hostConfig = {
        sim: 'test-sim',
        host: 'localhost',
        port: 8080,
        channel: 'test-channel',
        enabled: true,
        interfaceGateway: {
          port: 55555,
          enabled: false,
          username: 'testuser',
          password: 'plainpassword'
        }
      };
      
      await rocManager.addHost(hostConfig);
      
      const addedHost = rocManager.hosts[0];
      expect(addedHost.interfaceGateway.hasAuthentication()).toBe(true);
      expect(addedHost.interfaceGateway.username).toBe('testuser');
      expect(addedHost.interfaceGateway.encryptedPassword).toBeDefined();
      expect(addedHost.interfaceGateway.encryptedPassword).not.toBe('plainpassword');
      expect(addedHost.interfaceGateway.encryptedPassword).toMatch(/^[A-Za-z0-9+/]+=*:[A-Za-z0-9+/]+=*$/); // IV:encrypted format
      expect(addedHost.interfaceGateway.getDecryptedPassword()).toBe('plainpassword');
    });

    test('should create host without authentication when no credentials provided', async () => {
      rocManager.hosts = [];
      
      const hostConfig = {
        sim: 'test-sim',
        host: 'localhost',
        port: 8080,
        channel: 'test-channel',
        enabled: true,
        interfaceGateway: {
          port: 55555,
          enabled: false
        }
      };
      
      await rocManager.addHost(hostConfig);
      
      const addedHost = rocManager.hosts[0];
      expect(addedHost.interfaceGateway.hasAuthentication()).toBe(false);
      expect(addedHost.interfaceGateway.username).toBeUndefined();
      expect(addedHost.interfaceGateway.encryptedPassword).toBeUndefined();
    });

    test('should create host without authentication when username provided but no password', async () => {
      rocManager.hosts = [];
      
      const hostConfig = {
        sim: 'test-sim',
        host: 'localhost',
        port: 8080,
        channel: 'test-channel',
        enabled: true,
        interfaceGateway: {
          port: 55555,
          enabled: false,
          username: 'testuser'
          // No password provided
        }
      };
      
      await rocManager.addHost(hostConfig);
      
      const addedHost = rocManager.hosts[0];
      expect(addedHost.interfaceGateway.hasAuthentication()).toBe(false);
      expect(addedHost.interfaceGateway.username).toBe('testuser'); // Username is preserved from config
      expect(addedHost.interfaceGateway.encryptedPassword).toBeUndefined(); // But no password
    });

    test('should create host without authentication when password provided but no username', async () => {
      rocManager.hosts = [];
      
      const hostConfig = {
        sim: 'test-sim',
        host: 'localhost',
        port: 8080,
        channel: 'test-channel',
        enabled: true,
        interfaceGateway: {
          port: 55555,
          enabled: false,
          password: 'plainpassword'
          // No username provided
        }
      };
      
      await rocManager.addHost(hostConfig);
      
      const addedHost = rocManager.hosts[0];
      expect(addedHost.interfaceGateway.hasAuthentication()).toBe(false);
      expect(addedHost.interfaceGateway.username).toBeUndefined();
      expect(addedHost.interfaceGateway.encryptedPassword).toBeUndefined();
    });

  describe('updateHost defensive behavior', () => {
    test('should update host without changing sim and preserve IG state', async () => {
      const originalHostConfig = {
        sim: 'up-sim',
        host: 'original-host.example.com',
        port: 8080,
        channel: 'original-channel',
        enabled: true,
        interfaceGateway: { port: 51515, enabled: true }
      };

      // Start with an existing host
      rocManager.hosts = [Host.fromConfig(originalHostConfig)];

      // Mock deactivateGame to return preserved state
      jest.spyOn(rocManager, 'deactivateGame').mockResolvedValue({ panels: [], time: {}, connectionsOpen: false });
      const updateSpy = jest.spyOn(rocManager, 'updateAndSave').mockResolvedValue();
      const activateSpy = jest.spyOn(rocManager, 'activateGame').mockImplementation(jest.fn());

      const newHostConfig = {
        sim: 'up-sim', // same sim
        host: 'new-host.example.com',
        port: 9090,
        channel: 'new-channel',
        interfaceGateway: { port: 52525, enabled: false }
      };

      await rocManager.updateHost('up-sim', newHostConfig);

      // Verify host replaced and IG enabled preserved
      const added = rocManager.hosts.find(h => h.sim === 'up-sim');
      expect(added).toBeDefined();
      expect(added.host).toBe('new-host.example.com');
      expect(added.interfaceGateway.enabled).toBe(true); // preserved
      expect(updateSpy).toHaveBeenCalled();
      expect(activateSpy).toHaveBeenCalled();
    });

    test('should prevent updating to a sim that already has a host', async () => {
      // Setup: two hosts already exist
      const first = Host.fromConfig({ sim: 'first', host: 'a', port: 1, channel: 'c', interfaceGateway: { port: 111, enabled: false } });
      const second = Host.fromConfig({ sim: 'second', host: 'b', port: 2, channel: 'c2', interfaceGateway: { port: 222, enabled: false } });
      rocManager.hosts = [first, second];

      const updateAttempt = {
        sim: 'second', // target sim already exists
        host: 'newb',
        port: 3,
        channel: 'c3',
        interfaceGateway: { port: 333, enabled: false }
      };

      await expect(rocManager.updateHost('first', updateAttempt)).rejects.toThrow(/already exists/);

      // Ensure hosts unchanged
      expect(rocManager.hosts).toHaveLength(2);
      expect(rocManager.hosts.find(h => h.sim === 'first')).toBeDefined();
      expect(rocManager.hosts.find(h => h.sim === 'second')).toBeDefined();
    });

    test('should rollback and restore original host if updateAndSave fails', async () => {
      const originalHostConfig = {
        sim: 'rollback-original',
        host: 'orig.example.com',
        port: 8080,
        channel: 'orig-channel',
        enabled: true,
        interfaceGateway: { port: 51515, enabled: true }
      };
      rocManager.hosts = [Host.fromConfig(originalHostConfig)];

      // deactivateGame succeeds
      jest.spyOn(rocManager, 'deactivateGame').mockResolvedValue({ panels: [], time: {}, connectionsOpen: false });

      // First updateAndSave fails, then the rollback save succeeds
      const updateMock = jest.spyOn(rocManager, 'updateAndSave')
        .mockRejectedValueOnce(new Error('disk write failed'))
        .mockResolvedValueOnce();

      const newConfig = {
        sim: 'rollback-original',
        host: 'new.example.com',
        port: 9090,
        channel: 'new-channel',
        interfaceGateway: { port: 52525, enabled: false }
      };

      await expect(rocManager.updateHost('rollback-original', newConfig)).rejects.toThrow(/Failed to save config/);

      // Original host should be restored
      expect(rocManager.hosts.find(h => h.sim === 'rollback-original').host).toBe('orig.example.com');
    });

    test('should rollback and restore if activateGame fails and reactivate original host', async () => {
      const originalHostConfig = {
        sim: 'act-fail-original',
        host: 'orig2.example.com',
        port: 8080,
        channel: 'orig-channel-2',
        enabled: true,
        interfaceGateway: { port: 51515, enabled: true }
      };
      rocManager.hosts = [Host.fromConfig(originalHostConfig)];

      jest.spyOn(rocManager, 'deactivateGame').mockResolvedValue({ panels: [], time: {}, connectionsOpen: false });

      // updateAndSave succeeds
      jest.spyOn(rocManager, 'updateAndSave').mockResolvedValue();

      // activateGame throws when activating the new host but succeeds for the old host
      jest.spyOn(rocManager, 'activateGame').mockImplementation(async (host) => {
        if (host.sim === 'act-fail-original') {
          throw new Error('activation failed for new host');
        }
        return Promise.resolve();
      });

      const newConfig = {
        sim: 'act-fail-original',
        host: 'new2.example.com',
        port: 9090,
        channel: 'new-channel-2',
        interfaceGateway: { port: 52525, enabled: false }
      };

      await expect(rocManager.updateHost('act-fail-original', newConfig)).rejects.toThrow(/Failed to activate host/);

      // Original host should be restored
      expect(rocManager.hosts.find(h => h.sim === 'act-fail-original').host).toBe('orig2.example.com');
    });

    test('should prevent concurrent updates for the same simulation', async () => {
      const originalHostConfig = {
        sim: 'concurrent-update',
        host: 'concurrent.orig',
        port: 8080,
        channel: 'orig-channel',
        enabled: true,
        interfaceGateway: { port: 51515, enabled: true }
      };
      rocManager.hosts = [Host.fromConfig(originalHostConfig)];

      // Make activateGame delay to simulate long running activation
      jest.spyOn(rocManager, 'deactivateGame').mockResolvedValue({ panels: [], time: {}, connectionsOpen: false });
      jest.spyOn(rocManager, 'updateAndSave').mockResolvedValue();
      jest.spyOn(rocManager, 'activateGame').mockImplementation(() => new Promise(res => setTimeout(res, 50)));

      const newConfig = { sim: 'concurrent-update', host: 'new.concurrent', port: 9090, channel: 'c', interfaceGateway: { port: 52525, enabled: false } };

      // start first update
      const p1 = rocManager.updateHost('concurrent-update', newConfig);

      // second should reject due to lock
      await expect(rocManager.updateHost('concurrent-update', newConfig)).rejects.toThrow(/already in progress|Operation already in progress/i);

      await p1;
      expect(rocManager.hosts.find(h => h.sim === 'concurrent-update')).toBeDefined();
    });
  });

    test('should never include passwords in client object', async () => {
      rocManager.hosts = [];
      
      const hostConfig = {
        sim: 'test-sim',
        host: 'localhost',
        port: 8080,
        channel: 'test-channel',
        enabled: true,
        interfaceGateway: {
          port: 55555,
          enabled: false,
          username: 'testuser',
          password: 'secretpassword'
        }
      };
      
      await rocManager.addHost(hostConfig);
      
      const addedHost = rocManager.hosts[0];
      const clientObject = addedHost.toClientObject();
      
      expect(clientObject.interfaceGateway.username).toBe('testuser');
      expect(clientObject.interfaceGateway.hasPassword).toBe(true);
      expect(clientObject.interfaceGateway.password).toBeUndefined();
      expect(clientObject.interfaceGateway.encryptedPassword).toBeUndefined();
    });
  });

  describe('Interface Gateway Management', () => {
    test('disableInterfaceGateway removes client completely', () => {
      // Setup: Add a host and enable IG
      rocManager.hosts = [{
        sim: 'test-sim',
        host: 'localhost',
        port: 8080,
        channel: 'test-channel',
        enabled: true,
        interfaceGateway: {
          port: 55555,
          enabled: true,
          connectionState: 'connected'
        },
        disableInterfaceGateway: jest.fn(),
        toConfig: () => ({})
      }];
      
      // Mock the STOMP manager methods
      const mockRemoveClient = jest.fn();
      rocManager.stompManager.removeClientForGame = mockRemoveClient;
      rocManager.syncHostsWithConfig = jest.fn();
      rocManager.updateAdminUI = jest.fn();
      
      // Call disableInterfaceGateway
      rocManager.disableInterfaceGateway('test-sim');
      
      // Verify it calls removeClientForGame, not just deactivate
      expect(mockRemoveClient).toHaveBeenCalledWith('test-sim');
      expect(rocManager.hosts[0].disableInterfaceGateway).toHaveBeenCalled();
      // Should not persist transient IG state; do not save to config here
      expect(rocManager.syncHostsWithConfig).not.toHaveBeenCalled();
      expect(rocManager.updateAdminUI).toHaveBeenCalled();
    });

    describe('authentication integration (from validate-authentication.js)', () => {
      test('should handle host with authentication through addHost workflow', async () => {
        rocManager.hosts = [];
        
        const hostConfigWithAuth = {
          sim: 'auth-test-sim',
          host: 'localhost',
          port: 8080,
          channel: 'auth-test-channel',
          enabled: false,
          interfaceGateway: {
            port: 55555,
            enabled: false,
            username: 'authuser',
            password: 'authpassword'
          }
        };
        
        // Execute addHost
        await rocManager.addHost(hostConfigWithAuth);
        
        // Verify host was added correctly
        expect(rocManager.hosts).toHaveLength(1);
        const addedHost = rocManager.hosts[0];
        
        // Verify authentication was properly set up
        expect(addedHost.interfaceGateway.hasAuthentication()).toBe(true);
        expect(addedHost.interfaceGateway.username).toBe('authuser');
        expect(addedHost.interfaceGateway.getDecryptedPassword()).toBe('authpassword');
        
        // Verify client object security (passwords should not be exposed)
        const clientObj = addedHost.toClientObject();
        expect(clientObj.interfaceGateway.username).toBe('authuser');
        expect(clientObj.interfaceGateway.hasPassword).toBe(true);
        expect(clientObj.interfaceGateway.encryptedPassword).toBeUndefined();
        expect(clientObj.interfaceGateway.password).toBeUndefined();
        
        // Verify configuration persistence (encrypted password should be saved)
        const savedConfig = addedHost.toConfig();
        expect(savedConfig.interfaceGateway.username).toBe('authuser');
        expect(savedConfig.interfaceGateway.encryptedPassword).toBeDefined();
        expect(savedConfig.interfaceGateway.password).toBeUndefined();
      });

      test('should handle authentication round-trip through configuration', async () => {
        rocManager.hosts = [];
        
        // Add host with authentication
        const hostConfig = {
          sim: 'roundtrip-sim',
          host: 'localhost',
          port: 8080,
          channel: 'roundtrip-channel',
          interfaceGateway: {
            port: 55555,
            enabled: false,
            username: 'roundtripuser',
            password: 'roundtrippass'
          }
        };
        
        await rocManager.addHost(hostConfig);
        const originalHost = rocManager.hosts[0];
        
        // Save configuration
        const savedConfig = {
          ...rocManager.config,
          games: rocManager.hosts.map(h => h.toConfig())
        };
        
        // Clear hosts and reload from saved config
        rocManager.hosts = [];
        mockConfigurationManager.setCachedConfig(savedConfig);
        rocManager.load();
        
        // Verify authentication survived the round-trip
        expect(rocManager.hosts).toHaveLength(1);
        const restoredHost = rocManager.hosts[0];
        
        expect(restoredHost.interfaceGateway.hasAuthentication()).toBe(true);
        expect(restoredHost.interfaceGateway.username).toBe('roundtripuser');
        expect(restoredHost.interfaceGateway.getDecryptedPassword()).toBe('roundtrippass');
      });
    });
  });

  test('should rollback when activateGame fails and persist cleanup', async () => {
    rocManager.hosts = [];

    // Make activateGame throw to simulate activation failure
    jest.spyOn(rocManager, 'activateGame').mockImplementation(() => { throw new Error('activation failed'); });

    const updateSpy = jest.spyOn(rocManager, 'updateAndSave');

    const hostConfig = {
      sim: 'rollback-sim',
      host: 'localhost',
      port: 8080,
      channel: 'rollback-channel',
      interfaceGateway: { port: 51515, enabled: false }
    };

    await expect(rocManager.addHost(hostConfig)).rejects.toThrow(/Failed to activate host|activation failed/);

    // Host should have been rolled back
    expect(rocManager.hosts.filter(h => h.sim === 'rollback-sim')).toHaveLength(0);

    // Ensure that updateAndSave was attempted for cleanup
    expect(updateSpy).toHaveBeenCalled();
  });

  test('should prevent concurrent add operations for the same simulation', async () => {
    rocManager.hosts = [];

    // Activate will delay to simulate long-running activation
    jest.spyOn(rocManager, 'activateGame').mockImplementation(() => new Promise(res => setTimeout(res, 50)));

    const hostConfig = {
      sim: 'concurrent-sim',
      host: 'localhost',
      port: 8080,
      channel: 'concurrent-channel',
      interfaceGateway: { port: 51515, enabled: false }
    };

    // Start first addHost (will be pending)
    const p1 = rocManager.addHost(hostConfig);

    // Second immediate attempt should be rejected due to lock
    await expect(rocManager.addHost(hostConfig)).rejects.toThrow(/already in progress|Add operation already in progress/i);

    // Wait for first to finish
    await p1;

    // First should have succeeded and host present
    expect(rocManager.hosts.find(h => h.sim === 'concurrent-sim')).toBeDefined();
  });

  // Global cleanup for all ROCManager tests
  afterAll(() => {
    jest.restoreAllMocks();
    jest.clearAllTimers();
  });
});
