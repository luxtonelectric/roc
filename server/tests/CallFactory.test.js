// @ts-check
import { jest } from '@jest/globals';
import CallFactory, { CallBuilder, createQuickP2PCall, createEmergencyCall, createQuickGroupCall } from '../src/CallFactory.js';
import { CALL_TYPES, CALL_LEVELS } from '../src/model/CallConstants.js';
import { validateICallInterface } from '../src/model/ICall.js';

// Mock console methods to prevent noise in test output
console.log = jest.fn();
console.info = jest.fn();
console.error = jest.fn();
console.warn = jest.fn();

/**
 * Test suite for CallFactory and related utilities
 * 
 * This test suite validates:
 * - Call creation with proper type validation
 * - Factory methods for different call types
 * - Builder pattern implementation
 * - Batch creation functionality
 * - Parameter validation and error handling
 * - Interface compliance of created calls
 */
describe('CallFactory', () => {

  /**
   * Create a mock phone object for testing
   */
  const createMockPhone = (id, name = 'Test Phone') => ({
    getId: () => id,
    getName: () => name,
    toSimple: () => ({ id, name })
  });

  // Test data
  let mockPhone1, mockPhone2, mockPhone3;

  beforeEach(() => {
    jest.clearAllMocks();
    mockPhone1 = createMockPhone('phone1', 'Phone 1');
    mockPhone2 = createMockPhone('phone2', 'Phone 2');
    mockPhone3 = createMockPhone('phone3', 'Phone 3');
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  describe('Main Factory Method', () => {
    test('should create P2P call with valid parameters', () => {
      const call = CallFactory.createCall(CALL_TYPES.P2P, {
        sender: mockPhone1,
        receivers: mockPhone2,
        level: CALL_LEVELS.NORMAL
      });

      expect(call).toBeDefined();
      expect(call.type).toBe(CALL_TYPES.P2P);
      expect(call.level).toBe(CALL_LEVELS.NORMAL);
      expect(validateICallInterface(call)).toBe(true);
    });

    test('should create GROUP call with valid parameters', () => {
      const call = CallFactory.createCall(CALL_TYPES.GROUP, {
        sender: mockPhone1,
        groupId: 'test-group-123',
        level: CALL_LEVELS.URGENT
      });

      expect(call).toBeDefined();
      expect(call.type).toBe(CALL_TYPES.GROUP);
      expect(call.level).toBe(CALL_LEVELS.URGENT);
      expect(call.groupId).toBe('test-group-123');
      expect(validateICallInterface(call)).toBe(true);
    });

    test('should create REC call with valid parameters', () => {
      const call = CallFactory.createCall(CALL_TYPES.REC, {
        sender: mockPhone1,
        groupId: 'emergency-group-456'
      });

      expect(call).toBeDefined();
      expect(call.type).toBe(CALL_TYPES.REC);
      expect(call.level).toBe(CALL_LEVELS.EMERGENCY); // REC calls are always emergency
      expect(call.groupId).toBe('emergency-group-456');
      expect(validateICallInterface(call)).toBe(true);
    });

    test('should reject invalid call types', () => {
      expect(() => {
        CallFactory.createCall('invalid-type', {
          sender: mockPhone1,
          receivers: mockPhone2
        });
      }).toThrow('Invalid call type: invalid-type');
    });

    test('should reject invalid call levels', () => {
      expect(() => {
        CallFactory.createCall(CALL_TYPES.P2P, {
          sender: mockPhone1,
          receivers: mockPhone2,
          level: 'invalid-level'
        });
      }).toThrow('Invalid call level: invalid-level');
    });

    test('should reject missing parameters object', () => {
      expect(() => {
        CallFactory.createCall(CALL_TYPES.P2P, null);
      }).toThrow('Call parameters must be provided as an object');
    });

    test('should reject missing sender', () => {
      expect(() => {
        CallFactory.createCall(CALL_TYPES.P2P, /** @type {any} */ ({
          receivers: mockPhone2
        }));
      }).toThrow('Call sender/originator must be provided');
    });

    test('should use default level when not provided', () => {
      const call = CallFactory.createCall(CALL_TYPES.P2P, {
        sender: mockPhone1,
        receivers: mockPhone2
      });

      expect(call.level).toBe(CALL_LEVELS.NORMAL);
    });

    test('should validate level is allowed for call type', () => {
      // REC calls only allow emergency level - this should work
      const recCall = CallFactory.createCall(CALL_TYPES.REC, {
        sender: mockPhone1,
        groupId: 'test-group'
      });
      expect(recCall.level).toBe(CALL_LEVELS.EMERGENCY);
    });
  });

  describe('Specific Factory Methods', () => {
    describe('createP2PCall', () => {
      test('should create P2P call with single receiver', () => {
        const call = CallFactory.createP2PCall(mockPhone1, mockPhone2);
        
        expect(call.type).toBe(CALL_TYPES.P2P);
        expect(call.sender).toBe(mockPhone1);
        expect(call.receivers).toEqual([mockPhone2]);
        expect(call.level).toBe(CALL_LEVELS.NORMAL);
      });

      test('should create P2P call with array of receivers', () => {
        const call = CallFactory.createP2PCall(mockPhone1, [mockPhone2, mockPhone3]);
        
        expect(call.receivers).toEqual([mockPhone2, mockPhone3]);
      });

      test('should accept custom level and options', () => {
        const options = { allowCallWaiting: false };
        const call = CallFactory.createP2PCall(mockPhone1, mockPhone2, CALL_LEVELS.URGENT, options);
        
        expect(call.level).toBe(CALL_LEVELS.URGENT);
        expect(call.options.allowCallWaiting).toBe(false);
      });
    });

    describe('createGroupCall', () => {
      test('should create group call with required parameters', () => {
        const call = CallFactory.createGroupCall(mockPhone1, 'group-123');
        
        expect(call.type).toBe(CALL_TYPES.GROUP);
        expect(call.originator).toBe(mockPhone1);
        expect(call.groupId).toBe('group-123');
        expect(call.level).toBe(CALL_LEVELS.NORMAL);
      });

      test('should reject empty group ID', () => {
        expect(() => {
          CallFactory.createGroupCall(mockPhone1, '');
        }).toThrow('Group ID must be provided as a non-empty string');
      });

      test('should accept custom level and options', () => {
        const options = { immediateSetup: true };
        const call = CallFactory.createGroupCall(mockPhone1, 'group-123', CALL_LEVELS.URGENT, options);
        
        expect(call.level).toBe(CALL_LEVELS.URGENT);
        expect(call.options.immediateSetup).toBe(true);
      });
    });

    describe('createRECCall', () => {
      test('should create REC call with group ID', () => {
        const call = CallFactory.createRECCall(mockPhone1, 'emergency-123');
        
        expect(call.type).toBe(CALL_TYPES.REC);
        expect(call.originator).toBe(mockPhone1);
        expect(call.groupId).toBe('emergency-123');
        expect(call.level).toBe(CALL_LEVELS.EMERGENCY);
      });

      test('should auto-generate group ID when not provided', () => {
        const call = CallFactory.createRECCall(mockPhone1);
        
        expect(call.groupId).toBeDefined();
        expect(call.groupId).toMatch(/^REC-/);
        expect(call.level).toBe(CALL_LEVELS.EMERGENCY);
      });

      test('should set emergency-specific options', () => {
        const call = CallFactory.createRECCall(mockPhone1);
        
        expect(call.options.immediateSetup).toBe(true);
        expect(call.options.autoAnswer).toBe(true);
        expect(call.options.emergencyOverride).toBe(true);
      });
    });
  });

  describe('Builder Pattern', () => {
    test('should create builder instance', () => {
      const builder = CallFactory.builder();
      expect(builder).toBeInstanceOf(CallBuilder);
    });

    test('should build P2P call using fluent interface', () => {
      const call = CallFactory.builder()
        .type(CALL_TYPES.P2P)
        .sender(mockPhone1)
        .receivers(mockPhone2)
        .level(CALL_LEVELS.URGENT)
        .option('allowCallWaiting', false)
        .build();

      expect(call.type).toBe(CALL_TYPES.P2P);
      expect(call.level).toBe(CALL_LEVELS.URGENT);
      expect(call.options.allowCallWaiting).toBe(false);
    });

    test('should build GROUP call using fluent interface', () => {
      const call = CallFactory.builder()
        .type(CALL_TYPES.GROUP)
        .originator(mockPhone1)
        .groupId('test-group')
        .level(CALL_LEVELS.NORMAL)
        .options({ priority: 'high' })
        .build();

      expect(call.type).toBe(CALL_TYPES.GROUP);
      expect(call.groupId).toBe('test-group');
      expect(call.options.priority).toBe('high');
    });

    test('should require call type to be specified', () => {
      expect(() => {
        CallFactory.builder().sender(mockPhone1).build();
      }).toThrow('Call type must be specified');
    });

    test('should require sender for P2P calls', () => {
      expect(() => {
        CallFactory.builder()
          .type(CALL_TYPES.P2P)
          .receivers(mockPhone2)
          .build();
      }).toThrow('Sender must be specified for P2P calls');
    });

    test('should require originator for Group/REC calls', () => {
      expect(() => {
        CallFactory.builder()
          .type(CALL_TYPES.GROUP)
          .groupId('test-group')
          .build();
      }).toThrow('Originator must be specified for Group/REC calls');
    });
  });

  describe('Batch Creation', () => {
    test('should create multiple calls successfully', () => {
      const definitions = [
        {
          type: CALL_TYPES.P2P,
          sender: mockPhone1,
          receivers: mockPhone2
        },
        {
          type: CALL_TYPES.GROUP,
          sender: mockPhone2,
          groupId: 'group-123'
        },
        {
          type: CALL_TYPES.REC,
          sender: mockPhone3,
          groupId: 'emergency-456'
        }
      ];

      const calls = CallFactory.createBatch(definitions);
      
      expect(calls).toHaveLength(3);
      expect(calls[0].type).toBe(CALL_TYPES.P2P);
      expect(calls[1].type).toBe(CALL_TYPES.GROUP);
      expect(calls[2].type).toBe(CALL_TYPES.REC);
    });

    test('should fail if any call creation fails', () => {
      const definitions = [
        {
          type: CALL_TYPES.P2P,
          sender: mockPhone1,
          receivers: mockPhone2
        },
        {
          type: 'invalid-type', // This will fail
          sender: mockPhone2
        }
      ];

      expect(() => {
        CallFactory.createBatch(definitions);
      }).toThrow('Batch call creation failed');
    });

    test('should reject non-array input', () => {
      expect(() => {
        CallFactory.createBatch(/** @type {any} */ ('not an array'));
      }).toThrow('Call definitions must be provided as an array');
    });
  });

  describe('Parameter Validation', () => {
    test('should validate valid parameters', () => {
      const result = CallFactory.validateCallParams(CALL_TYPES.P2P, {
        sender: mockPhone1,
        receivers: mockPhone2
      });

      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    test('should return errors for invalid parameters', () => {
      const result = CallFactory.validateCallParams('invalid-type', {
        sender: mockPhone1
      });

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('Convenience Functions', () => {
    test('createQuickP2PCall should work', () => {
      const call = createQuickP2PCall(mockPhone1, mockPhone2, CALL_LEVELS.URGENT);
      
      expect(call.type).toBe(CALL_TYPES.P2P);
      expect(call.sender).toBe(mockPhone1);
      expect(call.level).toBe(CALL_LEVELS.URGENT);
    });

    test('createEmergencyCall should work', () => {
      const call = createEmergencyCall(mockPhone1, 'emergency-123');
      
      expect(call.type).toBe(CALL_TYPES.REC);
      expect(call.level).toBe(CALL_LEVELS.EMERGENCY);
      expect(call.groupId).toBe('emergency-123');
    });

    test('createQuickGroupCall should work', () => {
      const call = createQuickGroupCall(mockPhone1, 'group-123', CALL_LEVELS.NORMAL);
      
      expect(call.type).toBe(CALL_TYPES.GROUP);
      expect(call.groupId).toBe('group-123');
      expect(call.level).toBe(CALL_LEVELS.NORMAL);
    });
  });

  describe('Interface Compliance', () => {
    test('all created calls should implement ICall interface', () => {
      const p2pCall = CallFactory.createP2PCall(mockPhone1, mockPhone2);
      const groupCall = CallFactory.createGroupCall(mockPhone1, 'group-123');
      const recCall = CallFactory.createRECCall(mockPhone1);

      expect(validateICallInterface(p2pCall)).toBe(true);
      expect(validateICallInterface(groupCall)).toBe(true);
      expect(validateICallInterface(recCall)).toBe(true);
    });

    test('created calls should have working methods', () => {
      const call = CallFactory.createP2PCall(mockPhone1, mockPhone2);

      // Test basic method functionality
      expect(() => {
        call.updateStatus('accepted');
        call.setChannel('channel-123');
        call.getChannel();
        call.hasChannel();
        call.isActive();
        call.isTerminated();
        call.isOffered();
        call.includesPhone(mockPhone1);
        call.getAllPhones();
        call.toEmittable();
        call.toString();
      }).not.toThrow();
    });
  });

  describe('Placeholder / ID checks', () => {
    test('created calls should not use the placeholder id "mock-call-id" and should be unique', () => {
      const p2pA = CallFactory.createP2PCall(mockPhone1, mockPhone2);
      const p2pB = CallFactory.createP2PCall(mockPhone1, mockPhone3);

      expect(p2pA.id).toBeDefined();
      expect(p2pA.id).not.toBe('mock-call-id');
      expect(p2pB.id).toBeDefined();
      expect(p2pB.id).not.toBe('mock-call-id');
      expect(p2pA.id).not.toBe(p2pB.id);
    });

    test('GROUP and REC calls should not have placeholder ids', () => {
      const group = CallFactory.createGroupCall(mockPhone1, 'group-xyz');
      const rec = CallFactory.createRECCall(mockPhone1);

      expect(group.id).toBeDefined();
      expect(group.id).not.toBe('mock-call-id');
      expect(rec.id).toBeDefined();
      expect(rec.id).not.toBe('mock-call-id');
    });
  });
});