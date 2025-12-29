import { jest } from '@jest/globals';
import User from '../../src/model/user.js';

describe('User Base Class', () => {
  let mockSocket;
  
  beforeEach(() => {
    mockSocket = {
      id: 'test-socket-id',
      join: jest.fn(),
      discordId: undefined
    };
    jest.clearAllMocks();
  });

  describe('Constructor', () => {
    test('should create user with all required properties', () => {
      const user = new User(mockSocket, 'test-discord-id', 'test-voice-channel');
      
      expect(user.socket).toBe(mockSocket);
      expect(user.discordId).toBe('test-discord-id');
      expect(user.voiceChannelId).toBe('test-voice-channel');
      expect(user.avatarURL).toBe('');
      expect(user.displayName).toBe('');
      expect(user.isConnected).toBe(true);
      expect(user.role).toBe('user');
      expect(user.callQueue).toEqual({});
      expect(user.inCall).toBe(false);
    });

    test('should set connection states based on constructor parameters', () => {
      const userWithBoth = new User(mockSocket, 'test-id', 'voice-channel');
      expect(userWithBoth.connectionStates.webUI).toBe(true);
      expect(userWithBoth.connectionStates.discordVoice).toBe(true);

      const userWithSocketOnly = new User(mockSocket, 'test-id', null);
      expect(userWithSocketOnly.connectionStates.webUI).toBe(true);
      expect(userWithSocketOnly.connectionStates.discordVoice).toBe(false);

      const userWithVoiceOnly = new User(null, 'test-id', 'voice-channel');
      expect(userWithVoiceOnly.connectionStates.webUI).toBe(false);
      expect(userWithVoiceOnly.connectionStates.discordVoice).toBe(true);
    });
  });

  describe('Connection Management', () => {
    let user;

    beforeEach(() => {
      user = new User(null, 'test-id', null);
    });

    test('updateSocket should set socket and update connection state', () => {
      user.updateSocket(mockSocket);
      
      expect(user.socket).toBe(mockSocket);
      expect(user.connectionStates.webUI).toBe(true);
      expect(mockSocket.join).toHaveBeenCalledWith('test-id');
      expect(mockSocket.discordId).toBe('test-id');
    });

    test('updateSocket with null should clear connection state', () => {
      user.updateSocket(mockSocket);
      user.updateSocket(null);
      
      expect(user.socket).toBeNull();
      expect(user.connectionStates.webUI).toBe(false);
    });

    test('updateVoiceChannel should set voice channel and update connection state', () => {
      user.updateVoiceChannel('new-voice-channel');
      
      expect(user.voiceChannelId).toBe('new-voice-channel');
      expect(user.connectionStates.discordVoice).toBe(true);
    });

    test('updateVoiceChannel with null should clear connection state', () => {
      user.updateVoiceChannel('voice-channel');
      user.updateVoiceChannel(null);
      
      expect(user.voiceChannelId).toBeNull();
      expect(user.connectionStates.discordVoice).toBe(false);
    });

    test('isFullyConnected should return true when both connections are active', () => {
      user.updateSocket(mockSocket);
      user.updateVoiceChannel('voice-channel');
      
      expect(user.isFullyConnected()).toBe(true);
    });

    test('isFullyConnected should return false when only one connection is active', () => {
      user.updateSocket(mockSocket);
      expect(user.isFullyConnected()).toBe(false);
      
      user.updateSocket(null);
      user.updateVoiceChannel('voice-channel');
      expect(user.isFullyConnected()).toBe(false);
    });

    test('updateProfile should set avatar and display name', () => {
      user.updateProfile('https://avatar.url', 'Test User');
      
      expect(user.avatarURL).toBe('https://avatar.url');
      expect(user.displayName).toBe('Test User');
    });
  });

  describe('Base Permissions', () => {
    let user;

    beforeEach(() => {
      user = new User(mockSocket, 'test-id', 'voice-channel');
    });

    test('should return false for all permission checks by default', () => {
      expect(user.canMakeCalls()).toBe(false);
      expect(user.canReceiveCalls()).toBe(false);
      expect(user.canClaimPanel()).toBe(false);
      expect(user.canManageHosts()).toBe(false);
      expect(user.canManagePhones()).toBe(false);
      expect(user.canViewAllCalls()).toBe(false);
      expect(user.canKickFromCalls()).toBe(false);
    });
  });

  describe('Phone Integration', () => {
    let user;

    beforeEach(() => {
      user = new User(mockSocket, 'test-id', 'voice-channel');
    });

    test('getPhones should return empty array by default', () => {
      expect(user.getPhones()).toEqual([]);
    });

    test('getPhonesForCalls should return same as getPhones', () => {
      expect(user.getPhonesForCalls()).toEqual(user.getPhones());
    });
  });

  describe('Serialization', () => {
    let user;

    beforeEach(() => {
      user = new User(mockSocket, 'test-id', 'voice-channel');
      user.updateProfile('https://avatar.url', 'Test User');
    });

    test('toSimple should return basic user information', () => {
      const simple = user.toSimple();
      
      expect(simple).toEqual({
        discordId: 'test-id',
        displayName: 'Test User',
        avatarURL: 'https://avatar.url',
        isConnected: true,
        role: 'user'
      });
    });

    test('toDetailed should return comprehensive user information', () => {
      user.inCall = true;
      const detailed = user.toDetailed();
      
      expect(detailed).toEqual({
        discordId: 'test-id',
        displayName: 'Test User',
        avatarURL: 'https://avatar.url',
        isConnected: true,
        role: 'user',
        voiceChannelId: 'voice-channel',
        connectionStates: {
          webUI: true,
          discordVoice: true
        },
        inCall: true,
        phoneCount: 0
      });
    });

    test('toString should return formatted string representation', () => {
      const stringRep = user.toString();
      expect(stringRep).toBe('user(test-id:Test User)');
    });
  });
});