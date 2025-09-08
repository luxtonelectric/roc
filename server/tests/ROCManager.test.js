// @ts-nocheck
import { jest } from '@jest/globals';
import ROCManager from '../src/ROCManager.js';
import Player from '../src/model/player.js';
import Simulation from '../src/model/simulation.js';
import Phone from '../src/model/phone.js';

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
  createClientForGame() { return true; }
  activateClientForGame() { return true; }
  deactivateClientForGame() { return true; }
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
  saveConfig() { return Promise.resolve(); }
  loadConfig() { return Promise.resolve({}); }
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
    rocManager = new ROCManager(mockIo, mockDiscordBot, mockPhoneManager, mockSTOMPManager);
    rocManager.config = mockConfig;
    
    // Setup test player
    const testPlayer = new Player(mockSocket, 'test-user', 'test-channel');
    rocManager.players['test-user'] = testPlayer;

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
    // Spy on updatePlayerInfo method
    jest.spyOn(rocManager, 'updatePlayerInfo');

    // Execute
    rocManager.releasePanel('test-user', 'test-sim', 'test-panel');

    // Verify player info is updated
    expect(rocManager.updatePlayerInfo).toHaveBeenCalledWith(rocManager.players['test-user']);
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
          channel: 'test-channel',
          enabled: true,
          interfaceGateway: { port: 8080, enabled: false }
        }
      ]
    };
    
    rocManager.load(config);
    
    expect(rocManager.hosts).toHaveLength(1);
    expect(rocManager.hosts[0].sim).toBe('test-sim');
    expect(rocManager.hosts[0].host).toBe('localhost');
    expect(rocManager.hosts[0].channel).toBe('test-channel');
    expect(rocManager.hosts[0].enabled).toBe(true);
    expect(rocManager.hosts[0].interfaceGateway.port).toBe(8080);
    expect(rocManager.hosts[0].interfaceGateway.enabled).toBe(false);
  });
  
  test('getHostById returns correct host', () => {
    const config = {
      channels: { lobby: 'test-lobby', afk: 'test-afk' },
      games: [
        {
          sim: 'test-sim-1',
          host: 'localhost',
          channel: 'test-channel',
          enabled: true,
          interfaceGateway: { port: 8080, enabled: false }
        },
        {
          sim: 'test-sim-2',
          host: 'localhost',
          channel: 'test-channel-2',
          enabled: true,
          interfaceGateway: { port: 8081, enabled: false }
        }
      ]
    };
    
    rocManager.load(config);
    
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
          channel: 'test-channel',
          enabled: true,
          interfaceGateway: { port: 8080, enabled: false }
        }
      ]
    };
    
    rocManager.load(config);
    
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
    
    rocManager.load(config);
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
});
