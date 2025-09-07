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
