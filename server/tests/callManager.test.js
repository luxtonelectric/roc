import { jest } from '@jest/globals';
import CallManager from '../src/UnifiedCallManager.js';
import CallRequest from '../src/model/callrequest.js';
import Phone from '../src/model/phone.js';
import Player from '../src/model/player.js';
import Location from '../src/model/location.js';

// Mock chalk to prevent any potential issues
jest.mock('chalk', () => ({
  blue: jest.fn((msg) => msg),
  green: jest.fn((msg) => msg),
  yellow: jest.fn((msg) => msg),
  red: jest.fn((msg) => msg),
  white: jest.fn((msg) => msg)
}));

// Helper function to create test phone
function createTestPhone(id, name, discordId = null) {
  const phone = new Phone(id, name, Phone.TYPES.FIXED, new Location('test-location', 'Test Location'));
  if (discordId) {
    const player = new Player(null, discordId, null); // socket, discordId, voiceChannelId
    player.displayName = `Player${discordId}`;
    phone.setPlayer(player);
  }
  return phone;
}

// Test: CallManager constructor
test('CallManager should initialize with empty call maps', () => {
  const mockPhoneManager = {};
  const mockBot = {};
  const mockIO = {
      emit: jest.fn(),
      to: jest.fn(() => ({ emit: jest.fn() })),
      on: jest.fn()
    };
  
  const callManager = new CallManager(mockPhoneManager, mockBot, mockIO);
  
  expect(callManager.requestedCalls.size).toBe(0);
  expect(callManager.activeCalls.size).toBe(0);
  expect(callManager.pastCalls.size).toBe(0);
  expect(callManager.phoneManager).toBe(mockPhoneManager);
  expect(callManager.bot).toBe(mockBot);
  expect(callManager.io).toBe(mockIO);
});

// Test: placeCall - P2P call success
test('placeCall should successfully place a valid P2P call', async () => {
  const senderPhone = createTestPhone('phone1', 'Phone 1', 'discord1');
  const receiverPhone = createTestPhone('phone2', 'Phone 2', 'discord2');
  
  const mockPhoneManager = {
    getPhone: (id) => id === 'phone1' ? senderPhone : receiverPhone
  };
  
  const mockBot = {};
  
  let emittedEvents = [];
  const mockIO = {
    to: (discordId) => ({
      emit: (event, data) => emittedEvents.push({ discordId, event, data })
    })
  };
  
  const callManager = new CallManager(mockPhoneManager, mockBot, mockIO);
  
  const result = await callManager.placeCall({ senderPhoneId: 'phone1', callType: CallRequest.TYPES.P2P, callLevel: CallRequest.LEVELS.NORMAL, receiver: 'phone2' });
  
  expect(result).toBeTruthy();
  expect(typeof result).toBe('string');
  expect(callManager.requestedCalls.size).toBe(1);
  
  const call = Array.from(callManager.requestedCalls.values())[0];
  expect(call.sender).toBe(senderPhone);
  expect(call.getReceiver()).toBe(receiverPhone);
  expect(call.type).toBe(CallRequest.TYPES.P2P);
  expect(call.status).toBe(CallRequest.STATUS.OFFERED);
});

// Test: placeCall - reject self-call
test('placeCall should reject call when player tries to call themselves', async () => {
  const selfPhone = createTestPhone('self-phone', 'Self Phone', 'same-discord-id');
  
  const mockPhoneManager = {
    getPhone: () => selfPhone
  };
    const mockIo = {
      emit: jest.fn(),
      to: jest.fn(() => ({ emit: jest.fn() })),
      on: jest.fn()
    };

  const callManager = new CallManager(mockPhoneManager, {}, mockIo);
  
  const result = await callManager.placeCall({ senderPhoneId: 'self-phone', callType: CallRequest.TYPES.P2P, callLevel: CallRequest.LEVELS.NORMAL, receiver: 'self-phone' });
  
  expect(result).toBe(false);
  expect(callManager.requestedCalls.size).toBe(0);
});

// Test: placeCall - invalid sender phone
test('placeCall should reject call when sender phone does not exist', async () => {
  const mockPhoneManager = {
    getPhone: () => undefined
  };
    const mockIo = {
      emit: jest.fn(),
      to: jest.fn(() => ({ emit: jest.fn() })),
      on: jest.fn()
    };
  const callManager = new CallManager(mockPhoneManager, {}, mockIo);
  
  const result = await callManager.placeCall({ senderPhoneId: 'invalid-phone', callType: CallRequest.TYPES.P2P, callLevel: CallRequest.LEVELS.NORMAL, receiver: 'phone2' });
  
  expect(result).toBe(false);
  expect(callManager.requestedCalls.size).toBe(0);
});

// Test: placeCall - unassigned sender phone
test('placeCall should reject call when sender phone is not assigned to a player', async () => {
  const unassignedPhone = createTestPhone('unassigned', 'Unassigned Phone'); // No discordId
  
  const mockPhoneManager = {
    getPhone: () => unassignedPhone
  };
    const mockIo = {
      emit: jest.fn(),
      to: jest.fn(() => ({ emit: jest.fn() })),
      on: jest.fn()
    };
  const callManager = new CallManager(mockPhoneManager, {}, mockIo);
  
  const result = await callManager.placeCall({ senderPhoneId: 'unassigned', callType: CallRequest.TYPES.P2P, callLevel: CallRequest.LEVELS.NORMAL, receiver: 'phone2' });
  
  expect(result).toBe(false);
  expect(callManager.requestedCalls.size).toBe(0);
});

// Test: placeCall - REC call with EMERGENCY level (this should work)
test('placeCall should successfully place REC call with EMERGENCY level', async () => {
  const senderPhone = createTestPhone('phone1', 'Phone 1', 'discord1');
  const recPhone1 = createTestPhone('rec1', 'REC Phone 1', 'discord3');
  const recPhone2 = createTestPhone('rec2', 'REC Phone 2', 'discord4');
  
  const mockPhoneManager = {
    getPhone: () => senderPhone,
    getRECRecipientsForPhone: () => [recPhone1, recPhone2]
  };
  
  let emittedEvents = [];
  const mockIO = {
    to: (discordId) => ({
      emit: (event, data) => emittedEvents.push({ discordId, event, data })
    })
  };
  
  const callManager = new CallManager(mockPhoneManager, {}, mockIO);
  
  const result = await callManager.placeCall({ senderPhoneId: 'phone1', callType: CallRequest.TYPES.REC, callLevel: CallRequest.LEVELS.EMERGENCY });
  
  expect(result).toBeTruthy();
  expect(callManager.requestedCalls.size).toBe(1);
  
  const call = Array.from(callManager.requestedCalls.values())[0];
  expect(call.sender).toBe(senderPhone);
  expect(call.getReceivers()).toEqual([recPhone1, recPhone2]);
  expect(call.type).toBe(CallRequest.TYPES.REC);
  expect(call.level).toBe(CallRequest.LEVELS.EMERGENCY);
});

// Test: placeCall - REC call with non-EMERGENCY level (this should fail based on requirements)
test('placeCall should reject REC call with non-EMERGENCY level', async () => {
  const senderPhone = createTestPhone('phone1', 'Phone 1', 'discord1');
  const recPhone1 = createTestPhone('rec1', 'REC Phone 1', 'discord3');
  const recPhone2 = createTestPhone('rec2', 'REC Phone 2', 'discord4');
  
  const mockPhoneManager = {
    getPhone: () => senderPhone,
    getRECRecipientsForPhone: () => [recPhone1, recPhone2] // Recipients available but wrong level
  };
  const mockIO = {
    emit: jest.fn(),
    to: jest.fn(() => ({ emit: jest.fn() })),
    on: jest.fn()
  };
  const callManager = new CallManager(mockPhoneManager, {}, mockIO);
  
  const result = await callManager.placeCall({ senderPhoneId: 'phone1', callType: CallRequest.TYPES.REC, callLevel: CallRequest.LEVELS.NORMAL });
  
  // This should fail because REC calls should require EMERGENCY level
  expect(result).toBe(false);
  expect(callManager.requestedCalls.size).toBe(0);
});

// Test: rejectCall - successful rejection
test('rejectCall should successfully reject a call', async () => {
  const senderPhone = createTestPhone('phone1', 'Phone 1', 'discord1');
  const receiverPhone = createTestPhone('phone2', 'Phone 2', 'discord2');
  
  const mockPhoneManager = {
    getPhone: (id) => id === 'phone1' ? senderPhone : receiverPhone
  };
  
  const mockBot = {
    releasePrivateCallChannelReservation: () => {}
  };
  
  let emittedEvents = [];
  const mockIO = {
    to: (discordId) => ({
      emit: (event, data) => emittedEvents.push({ discordId, event, data })
    })
  };
  
  const callManager = new CallManager(mockPhoneManager, mockBot, mockIO);
  
  // Place a call first
  const callId = await callManager.placeCall({ senderPhoneId: 'phone1', callType: CallRequest.TYPES.P2P, callLevel: CallRequest.LEVELS.NORMAL, receiver: 'phone2' });
  
  // Reject the call (await the Promise)
  const result = await callManager.rejectCall('socket123', callId);
  
  expect(result).toBe(true);
  expect(callManager.requestedCalls.size).toBe(0);
  expect(callManager.pastCalls.size).toBe(1);
  
  const rejectedCall = Array.from(callManager.pastCalls.values())[0];
  expect(rejectedCall.status).toBe(CallRequest.STATUS.REJECTED);
});

// Test: rejectCall - non-existent call
test('rejectCall should return false when trying to reject non-existent call', async () => {
    const mockIO = {
    emit: jest.fn(),
    to: jest.fn(() => ({ emit: jest.fn() })),
    on: jest.fn()
  };
  const callManager = new CallManager({}, {}, mockIO);
  
  const result = await callManager.rejectCall('socket123', 'non-existent-call-id');
  
  expect(result).toBe(false);
});

// Test: getCallQueueForPhone - should show requested, ongoing and last 10 past calls
test('getCallQueueForPhone should show requested, ongoing and last 10 past calls', () => {
  const senderPhone = createTestPhone('phone1', 'Phone 1', 'discord1');
  const receiverPhone = createTestPhone('phone2', 'Phone 2', 'discord2');
  
  const mockPhoneManager = {
    getPhone: (id) => id === 'phone1' ? senderPhone : receiverPhone
  };
    const mockIO = {
    emit: jest.fn(),
    to: jest.fn(() => ({ emit: jest.fn() })),
    on: jest.fn()
  };
  const callManager = new CallManager(mockPhoneManager, {}, mockIO);
  
  // Create 1 requested call
  const requestedCall = new CallRequest(senderPhone, receiverPhone);
  callManager.requestedCalls.set(requestedCall.id, requestedCall);
  
  // Create 1 ongoing call (activeCalls Map)
  const ongoingCall = new CallRequest(receiverPhone, senderPhone);
  ongoingCall.status = CallRequest.STATUS.ACCEPTED;
  callManager.activeCalls.set(ongoingCall.id, ongoingCall);
  
  // Create 15 past calls (should only show last 10)
  const pastCallIds = [];
  for (let i = 0; i < 15; i++) {
    const pastCall = new CallRequest(senderPhone, receiverPhone);
    pastCall.status = CallRequest.STATUS.ENDED;
    callManager.pastCalls.set(pastCall.id, pastCall);
    pastCallIds.push(pastCall.id);
  }
  
  const queue = callManager.getCallQueueForPhone(senderPhone);
  
  // Should include 1 requested + 1 ongoing + 10 past = 12 total
  expect(queue).toHaveLength(12);
  expect(queue.some(call => call.id === requestedCall.id)).toBe(true);
  expect(queue.some(call => call.id === ongoingCall.id)).toBe(true);
  
  // Should include the last 10 past calls (indexes 5-14)
  for (let i = 5; i < 15; i++) {
    expect(queue.some(call => call.id === pastCallIds[i])).toBe(true);
  }
  
  // Should NOT include the first 5 past calls (indexes 0-4)
  for (let i = 0; i < 5; i++) {
    expect(queue.some(call => call.id === pastCallIds[i])).toBe(false);
  }
});

// Test: isPlayerOnRECCall
test('isPlayerOnRECCall should correctly identify if player is on REC call', () => {
  const senderPhone = createTestPhone('phone1', 'Phone 1', 'discord1');
  const recPhone = createTestPhone('rec1', 'REC Phone 1', 'discord3');
    const mockIO = {
    emit: jest.fn(),
    to: jest.fn(() => ({ emit: jest.fn() })),
    on: jest.fn()
  };
  const callManager = new CallManager({}, {}, mockIO);
  
  // No calls initially
  expect(callManager.isPlayerOnRECCall('discord1')).toBe(false);
  
  // Add REC call
  const recCall = new CallRequest(senderPhone, [recPhone], CallRequest.TYPES.REC, CallRequest.LEVELS.EMERGENCY);
  recCall.status = CallRequest.STATUS.ACCEPTED;
  callManager.ongoingCalls.push(recCall);
  

  
  // Should detect sender is on REC call
  expect(callManager.isPlayerOnRECCall('discord1')).toBe(true);
  // Should detect receiver is on REC call
  expect(callManager.isPlayerOnRECCall('discord3')).toBe(true);
  // Should not detect unrelated player
  expect(callManager.isPlayerOnRECCall('discord999')).toBe(false);
  
  // Add P2P call - should not affect REC call detection
  const p2pCall = new CallRequest(senderPhone, recPhone, CallRequest.TYPES.P2P);
  p2pCall.status = CallRequest.STATUS.ACCEPTED;
  callManager.ongoingCalls.push(p2pCall);
  
  // Should still correctly identify REC call participation
  expect(callManager.isPlayerOnRECCall('discord1')).toBe(true);
});

// Test: placeCall - P2P call with URGENT level should preserve level (BUG REPRODUCTION)
test('placeCall should preserve URGENT level for P2P calls', async () => {
  const senderPhone = createTestPhone('phone1', 'Phone 1', 'discord1');
  const receiverPhone = createTestPhone('phone2', 'Phone 2', 'discord2');
  
  const mockPhoneManager = {
    getPhone: (id) => id === 'phone1' ? senderPhone : receiverPhone
  };
  
  const mockBot = {};
  
  let emittedEvents = [];
  const mockIO = {
    to: (discordId) => ({
      emit: (event, data) => emittedEvents.push({ discordId, event, data })
    })
  };
  
  const callManager = new CallManager(mockPhoneManager, mockBot, mockIO);
  
  // Place a P2P call with URGENT level
  const result = await callManager.placeCall({ senderPhoneId: 'phone1', callType: CallRequest.TYPES.P2P, callLevel: CallRequest.LEVELS.URGENT, receiver: 'phone2' });
  
  expect(result).toBeTruthy();
  expect(typeof result).toBe('string');
  expect(callManager.requestedCalls.size).toBe(1);
  
  const call = Array.from(callManager.requestedCalls.values())[0];
  expect(call.sender).toBe(senderPhone);
  expect(call.getReceiver()).toBe(receiverPhone);
  expect(call.type).toBe(CallRequest.TYPES.P2P);
  expect(call.status).toBe(CallRequest.STATUS.OFFERED);
  
  // This is the bug - the call level should be URGENT
  expect(call.level).toBe(CallRequest.LEVELS.URGENT);
});

// Test: placeCall - P2P call with EMERGENCY level should preserve level  
test('placeCall should preserve EMERGENCY level for P2P calls', async () => {
  const senderPhone = createTestPhone('phone1', 'Phone 1', 'discord1');
  const receiverPhone = createTestPhone('phone2', 'Phone 2', 'discord2');
  
  const mockPhoneManager = {
    getPhone: (id) => id === 'phone1' ? senderPhone : receiverPhone
  };
  
  const mockBot = {};
  
  let emittedEvents = [];
  const mockIO = {
    to: (discordId) => ({
      emit: (event, data) => emittedEvents.push({ discordId, event, data })
    })
  };
  
  const callManager = new CallManager(mockPhoneManager, mockBot, mockIO);
  
  // Place a P2P call with EMERGENCY level  
  const result = await callManager.placeCall({ senderPhoneId: 'phone1', callType: CallRequest.TYPES.P2P, callLevel: CallRequest.LEVELS.EMERGENCY, receiver: 'phone2' });
  
  expect(result).toBeTruthy();
  expect(typeof result).toBe('string');
  expect(callManager.requestedCalls.size).toBe(1);
  
  const call = Array.from(callManager.requestedCalls.values())[0];
  expect(call.sender).toBe(senderPhone);
  expect(call.getReceiver()).toBe(receiverPhone);
  expect(call.type).toBe(CallRequest.TYPES.P2P);
  expect(call.status).toBe(CallRequest.STATUS.OFFERED);
  
  // This should also preserve the EMERGENCY level
  expect(call.level).toBe(CallRequest.LEVELS.EMERGENCY);
});

// Global cleanup for callManager tests
afterEach(() => {
  jest.clearAllMocks();
  jest.clearAllTimers();
});

afterAll(() => {
  jest.restoreAllMocks();
  jest.clearAllTimers();
});
