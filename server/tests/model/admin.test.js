import { jest } from '@jest/globals';
import Admin from '../../src/model/admin.js';
import User from '../../src/model/user.js';

describe('Admin Class', () => {
  let mockSocket;
  
  beforeEach(() => {
    mockSocket = {
      id: 'test-socket-id',
      join: jest.fn(),
      discordId: undefined
    };
    jest.clearAllMocks();
  });

  describe('Inheritance', () => {
    test('should extend User base class', () => {
      const admin = new Admin(mockSocket, 'test-discord-id', 'test-voice-channel');
      expect(admin).toBeInstanceOf(User);
      expect(admin).toBeInstanceOf(Admin);
    });

    test('should override role to admin', () => {
      const admin = new Admin(mockSocket, 'test-discord-id', 'test-voice-channel');
      expect(admin.role).toBe('admin');
    });
  });

  describe('Constructor', () => {
    test('should create admin with inherited properties', () => {
      const admin = new Admin(mockSocket, 'test-discord-id', 'test-voice-channel');
      
      // Inherited properties
      expect(admin.socket).toBe(mockSocket);
      expect(admin.discordId).toBe('test-discord-id');
      expect(admin.voiceChannelId).toBe('test-voice-channel');
      expect(admin.role).toBe('admin');
      expect(admin.callQueue).toEqual({});
      expect(admin.inCall).toBe(false);
    });
  });

  describe('Enhanced Permissions', () => {
    let admin;

    beforeEach(() => {
      admin = new Admin(mockSocket, 'test-discord-id', 'test-voice-channel');
    });

    test('should have all basic permissions', () => {
      expect(admin.canMakeCalls()).toBe(true);
      expect(admin.canReceiveCalls()).toBe(true);
      expect(admin.canClaimPanel()).toBe(true);
    });

    test('should have admin-specific permissions', () => {
      expect(admin.canManageHosts()).toBe(true);
      expect(admin.canManagePhones()).toBe(true);
      expect(admin.canViewAllCalls()).toBe(true);
      expect(admin.canKickFromCalls()).toBe(true);
    });
  });

  describe('Phone Integration', () => {
    let admin;

    beforeEach(() => {
      admin = new Admin(mockSocket, 'test-discord-id', 'test-voice-channel');
    });

    test('getPhones should return empty array when no global phoneManager', () => {
      expect(admin.getPhones()).toEqual([]);
    });

    test('getPhones should use global phoneManager when available', () => {
      const mockPhones = [{ id: 'admin-phone1' }, { id: 'admin-phone2' }];
      global.phoneManager = {
        getPhonesForDiscordId: jest.fn().mockReturnValue(mockPhones)
      };

      const phones = admin.getPhones();
      expect(phones).toBe(mockPhones);
      expect(global.phoneManager.getPhonesForDiscordId).toHaveBeenCalledWith('test-discord-id');
      
      // Cleanup
      delete global.phoneManager;
    });

    test('getPhones should handle null return from phoneManager', () => {
      global.phoneManager = {
        getPhonesForDiscordId: jest.fn().mockReturnValue(null)
      };

      const phones = admin.getPhones();
      expect(phones).toEqual([]);
      
      // Cleanup
      delete global.phoneManager;
    });
  });

  describe('Configuration Authorization', () => {
    let admin;

    beforeEach(() => {
      admin = new Admin(mockSocket, 'admin-discord-id', 'test-voice-channel');
    });

    test('isAuthorizedForConfig should return true when admin is in superUsers', () => {
      const superUsers = ['admin-discord-id', 'another-admin'];
      expect(admin.isAuthorizedForConfig(superUsers)).toBe(true);
    });

    test('isAuthorizedForConfig should return false when admin is not in superUsers', () => {
      const superUsers = ['other-admin', 'another-admin'];
      expect(admin.isAuthorizedForConfig(superUsers)).toBe(false);
    });

    test('isAuthorizedForConfig should return false for empty superUsers array', () => {
      expect(admin.isAuthorizedForConfig([])).toBe(false);
    });
  });

  describe('Admin-Specific Data', () => {
    let admin;

    beforeEach(() => {
      admin = new Admin(mockSocket, 'admin-discord-id', 'test-voice-channel');
      admin.updateProfile('https://admin-avatar.url', 'Test Admin');
    });

    test('toAdminData should include detailed info and permissions', () => {
      admin.inCall = true;
      const adminData = admin.toAdminData();
      
      // Should include all detailed information
      expect(adminData.discordId).toBe('admin-discord-id');
      expect(adminData.displayName).toBe('Test Admin');
      expect(adminData.role).toBe('admin');
      expect(adminData.inCall).toBe(true);
      
      // Should include permission information
      expect(adminData.permissions).toEqual({
        canManageHosts: true,
        canManagePhones: true,
        canViewAllCalls: true,
        canKickFromCalls: true
      });
    });
  });

  describe('Inherited Functionality', () => {
    let admin;

    beforeEach(() => {
      admin = new Admin(mockSocket, 'admin-discord-id', 'test-voice-channel');
      admin.updateProfile('https://admin-avatar.url', 'Test Admin');
    });

    test('should inherit connection management methods', () => {
      expect(typeof admin.updateSocket).toBe('function');
      expect(typeof admin.updateVoiceChannel).toBe('function');
      expect(typeof admin.isFullyConnected).toBe('function');
      expect(typeof admin.updateProfile).toBe('function');
    });

    test('should inherit base serialization methods', () => {
      const detailed = admin.toDetailed();
      expect(detailed.role).toBe('admin');
      expect(detailed.discordId).toBe('admin-discord-id');
      expect(detailed.displayName).toBe('Test Admin');
    });

    test('toString should show admin role', () => {
      const stringRep = admin.toString();
      expect(stringRep).toBe('admin(admin-discord-id:Test Admin)');
    });
  });
});