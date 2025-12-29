import { jest } from '@jest/globals';
import BaseCall from '../src/model/BaseCall.js';
import CallRequest from '../src/model/callrequest.js';
import GroupCallRequest from '../src/model/groupcallrequest.js';
import Phone from '../src/model/phone.js';
import CallGroup from '../src/model/CallGroup.js';

// Mock console methods
console.log = jest.fn();
console.info = jest.fn();
console.error = jest.fn();
console.warn = jest.fn();

describe('Call Models', () => {
  let mockPhone1, mockPhone2, mockCallGroup;

  beforeEach(() => {
    jest.clearAllMocks();

    // Create mock phones
    mockPhone1 = new Phone('SIM001', 'Test Phone 1', 'fixed');
    mockPhone2 = new Phone('SIM002', 'Test Phone 2', 'fixed');

    // Create mock users for phones
    const mockUser1 = { discordId: 'discord123', socket: { id: 'socket123' } };
    const mockUser2 = { discordId: 'discord456', socket: { id: 'socket456' } };
    mockPhone1.setPlayer(mockUser1);
    mockPhone2.setPlayer(mockUser2);

    // Create mock call group
    mockCallGroup = new CallGroup('TEST_GROUP', 'Test Group', ['SIM001', 'SIM002']);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  describe('BaseCall', () => {
    test('should have correct constants defined', () => {
      expect(BaseCall.TYPES.P2P).toBe('p2p');
      expect(BaseCall.TYPES.GROUP).toBe('group');
      expect(BaseCall.TYPES.REC).toBe('REC');

      expect(BaseCall.LEVELS.NORMAL).toBe('normal');
      expect(BaseCall.LEVELS.URGENT).toBe('urgent');
      expect(BaseCall.LEVELS.EMERGENCY).toBe('emergency');

      expect(BaseCall.STATUS.OFFERED).toBe('offered');
      expect(BaseCall.STATUS.ACCEPTED).toBe('accepted');
      expect(BaseCall.STATUS.REJECTED).toBe('rejected');
      expect(BaseCall.STATUS.ENDED).toBe('ended');
    });
  });

  describe('CallRequest', () => {
    test('should create P2P call request correctly', () => {
      const call = new CallRequest(mockPhone1, mockPhone2, BaseCall.LEVELS.NORMAL, BaseCall.TYPES.P2P);
      
      expect(call.sender).toBe(mockPhone1);
      expect(call.receivers).toContain(mockPhone2);
      expect(call.level).toBe(BaseCall.LEVELS.NORMAL);
      expect(call.type).toBe(BaseCall.TYPES.P2P);
      expect(call.status).toBeDefined();
      expect(call.id).toBeDefined();
      expect(typeof call.timePlaced).toBe('number');
    });

    test('should handle call state validations', () => {
      const call = new CallRequest(mockPhone1, mockPhone2, BaseCall.LEVELS.NORMAL, BaseCall.TYPES.P2P);
      
      // Test basic properties
      expect(call.sender).toBe(mockPhone1);
      expect(Array.isArray(call.receivers)).toBe(true);
      expect(call.receivers.length).toBe(1);
      expect(call.receivers[0]).toBe(mockPhone2);
    });
  });

  describe('GroupCallRequest', () => {
    test('should create group call request correctly', () => {
      const call = new GroupCallRequest(mockPhone1, 'TEST_GROUP', BaseCall.TYPES.GROUP, BaseCall.LEVELS.URGENT);
      
      expect(call.originator).toBe(mockPhone1);
      expect(call.groupId).toBe('TEST_GROUP');
      expect(call.level).toBe(BaseCall.LEVELS.URGENT);
      expect(call.type).toBe(BaseCall.TYPES.GROUP);
      expect(call.status).toBeDefined();
      expect(call.participants).toBeInstanceOf(Set);
    });

    test('should create REC call request correctly', () => {
      const call = new GroupCallRequest(mockPhone1, 'TEST_GROUP', BaseCall.TYPES.REC, BaseCall.LEVELS.EMERGENCY);
      
      expect(call.type).toBe(BaseCall.TYPES.REC);
      expect(call.level).toBe(BaseCall.LEVELS.EMERGENCY);
      expect(call.originator).toBe(mockPhone1);
      expect(call.groupId).toBe('TEST_GROUP');
    });

    test('should validate call type restrictions', () => {
      expect(() => {
        new GroupCallRequest(mockPhone1, 'TEST_GROUP', BaseCall.TYPES.P2P, BaseCall.LEVELS.NORMAL);
      }).toThrow('GroupCallRequest only supports GROUP and REC types');
    });
  });
});
