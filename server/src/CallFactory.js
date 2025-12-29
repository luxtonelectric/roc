// @ts-check
import { CALL_TYPES, CALL_LEVELS, isValidCallType, isValidCallLevel, isLevelAllowedForType } from './model/CallConstants.js';
import { ICall } from './model/ICall.js';
import CallRequest from './model/callrequest.js';
/** @typedef {import("./model/phone.js").default} Phone */

/**
 * CallFactory - Factory pattern implementation for creating unified call instances
 * 
 * This factory provides a centralized way to create call objects of different types
 * while ensuring proper validation, configuration, and interface compliance.
 * 
 * The factory supports:
 * - Type-based call instantiation (P2P, GROUP, REC)
 * - Automatic validation of call parameters
 * - Proper configuration of type-specific options
 * - Interface compliance verification
 * - Flexible creation patterns for different use cases
 * 
 * Design Pattern: Abstract Factory + Builder pattern
 * - Factory methods for each call type
 * - Builder pattern for complex call configuration
 * - Validation and error handling built-in
 */

/**
 * CallFactory class - Main factory for creating unified call instances
 */
export default class CallFactory {
  
  /**
   * Create a new call instance based on type and parameters
   * This is the main factory method that delegates to specific creators
   * 
   * @param {string} type - Call type (P2P, GROUP, REC)
   * @param {Object} params - Call parameters
   * @param {Phone} params.sender - Originating phone (for P2P) or originator (for GROUP/REC)
   * @param {Phone|Phone[]} [params.receivers] - Target phones (P2P only)
   * @param {string} [params.groupId] - Group identifier (GROUP/REC only)
   * @param {string} [params.level] - Call priority level
   * @param {Object} [params.options] - Additional call options
   * @returns {Object} Created call instance implementing ICall interface
   * @throws {Error} If invalid parameters or call type
   */
  static createCall(type, params) {
    // Validate call type
    if (!isValidCallType(type)) {
      throw new Error(`Invalid call type: ${type}. Must be one of: ${Object.values(CALL_TYPES).join(', ')}`);
    }

    // Validate required parameters
    if (!params || typeof params !== 'object') {
      throw new Error('Call parameters must be provided as an object');
    }

    if (!params.sender) {
      throw new Error('Call sender/originator must be provided');
    }

    // Set default level if not provided
    const level = params.level || CALL_LEVELS.NORMAL;
    
    // Validate level
    if (!isValidCallLevel(level)) {
      throw new Error(`Invalid call level: ${level}. Must be one of: ${Object.values(CALL_LEVELS).join(', ')}`);
    }

    // Auto-correct level for REC calls - they must be emergency
    let finalLevel = level;
    if (type === CALL_TYPES.REC) {
      finalLevel = CALL_LEVELS.EMERGENCY;
    }
    
    // Validate level is allowed for this call type
    if (!isLevelAllowedForType(type, finalLevel)) {
      throw new Error(`Call level ${finalLevel} is not allowed for call type ${type}`);
    }

    // Delegate to specific factory methods based on type
    switch (type) {
      case CALL_TYPES.P2P:
        return CallFactory.createP2PCall(params.sender, params.receivers, finalLevel, params.options);
        
      case CALL_TYPES.GROUP:
        return CallFactory.createGroupCall(params.sender, params.groupId, finalLevel, params.options);
        
      case CALL_TYPES.REC:
        return CallFactory.createRECCall(params.sender, params.groupId, params.options);
        
      default:
        throw new Error(`Unsupported call type: ${type}`);
    }
  }

  /**
   * Create a Point-to-Point call instance
   * 
   * @param {Phone} sender - Originating phone
   * @param {Phone|Phone[]} receivers - Target phone(s) - will use first if array
   * @param {string} [level] - Call priority level
   * @param {Object} [options] - Additional options
   * @returns {Object} P2P call instance
   * @throws {Error} If invalid parameters
   */
  static createP2PCall(sender, receivers, level = CALL_LEVELS.NORMAL, options = {}) {
    // Create an actual CallRequest instance for P2P calls so state transitions work correctly
    const receiverList = Array.isArray(receivers) ? receivers : [receivers];
    const call = new CallRequest(sender, receiverList, level, CALL_TYPES.P2P);
    // Attach options if present
    call.options = {
      allowCallWaiting: true,
      enableAutoAnswer: false,
      ...options
    };
    return call;
  }

  /**
   * Create a Group call instance
   * 
   * @param {Phone} originator - Call originator
   * @param {string} groupId - Group identifier
   * @param {string} [level] - Call priority level  
   * @param {Object} [options] - Additional options
   * @returns {Object} Group call instance
   * @throws {Error} If invalid parameters
   */
  static createGroupCall(originator, groupId, level = CALL_LEVELS.NORMAL, options = {}) {
    if (!groupId || typeof groupId !== 'string') {
      throw new Error('Group ID must be provided as a non-empty string');
    }

    // For now, return a placeholder that will be replaced with actual Group call class in TASK-008
    const callData = {
      type: CALL_TYPES.GROUP,
      originator,
      groupId,
      level,
      options: {
        immediateSetup: false,
        autoAnswer: false,
        priority: level,
        ...options
      }
    };

    return CallFactory._createPlaceholderCall(callData);
  }

  /**
   * Create a Railway Emergency Call (REC) instance
   * 
   * @param {Phone} originator - Call originator
   * @param {string} [groupId] - Group identifier (auto-generated if not provided)
   * @param {Object} [options] - Additional options
   * @returns {Object} REC call instance
   * @throws {Error} If invalid parameters
   */
  static createRECCall(originator, groupId = null, options = {}) {
    // REC calls are always emergency priority
    const level = CALL_LEVELS.EMERGENCY;
    
    // Auto-generate group ID if not provided
    const finalGroupId = groupId || `REC-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // For now, return a placeholder that will be replaced with actual REC call class in TASK-008
    const callData = {
      type: CALL_TYPES.REC,
      originator,
      groupId: finalGroupId,
      level,
      options: {
        immediateSetup: true,
        autoAnswer: true,
        priority: level,
        emergencyOverride: true,
        ...options
      }
    };

    return CallFactory._createPlaceholderCall(callData);
  }

  /**
   * Create a call instance from emittable data (for deserialization)
   * 
   * @param {Object} emittableData - Serialized call data from toEmittable()
   * @returns {Object} Reconstructed call instance
   * @throws {Error} If invalid data
   */
  static createFromEmittable(emittableData) {
    if (!emittableData || typeof emittableData !== 'object') {
      throw new Error('Emittable data must be provided as an object');
    }

    const { type, sender, receivers, originator, groupId, level, options } = emittableData;

    if (!type) {
      throw new Error('Call type must be specified in emittable data');
    }

    // Reconstruct call based on type
    switch (type) {
      case CALL_TYPES.P2P:
        if (!sender || !receivers) {
          throw new Error('P2P call data must include sender and receivers');
        }
        return CallFactory.createP2PCall(sender, receivers, level, options);
        
      case CALL_TYPES.GROUP:
      case CALL_TYPES.REC:
        if (!originator || !groupId) {
          throw new Error(`${type} call data must include originator and groupId`);
        }
        return type === CALL_TYPES.REC 
          ? CallFactory.createRECCall(originator, groupId, options)
          : CallFactory.createGroupCall(originator, groupId, level, options);
        
      default:
        throw new Error(`Unsupported call type in emittable data: ${type}`);
    }
  }

  /**
   * Builder pattern implementation for complex call creation
   * 
   * @returns {CallBuilder} Builder instance for fluent call creation
   */
  static builder() {
    return new CallBuilder();
  }

  /**
   * Batch create multiple calls with validation
   * 
   * @param {Array} callDefinitions - Array of call definition objects
   * @returns {Array} Array of created call instances
   * @throws {Error} If any call creation fails
   */
  static createBatch(callDefinitions) {
    if (!Array.isArray(callDefinitions)) {
      throw new Error('Call definitions must be provided as an array');
    }

    const results = [];
    const errors = [];

    for (let i = 0; i < callDefinitions.length; i++) {
      try {
        const definition = callDefinitions[i];
        const call = CallFactory.createCall(definition.type, definition);
        results.push(call);
      } catch (error) {
        errors.push(`Call ${i}: ${error.message}`);
      }
    }

    if (errors.length > 0) {
      throw new Error(`Batch call creation failed:\n${errors.join('\n')}`);
    }

    return results;
  }

  /**
   * Validate call creation parameters without creating the call
   * 
   * @param {string} type - Call type
   * @param {Object} params - Call parameters
   * @returns {{valid: boolean, errors: string[]}} Validation result
   */
  static validateCallParams(type, params) {
    const errors = [];

    try {
      // This will throw if parameters are invalid
      const testCall = CallFactory.createCall(type, params);
      // If we get here, parameters are valid
      return { valid: true, errors: [] };
    } catch (error) {
      errors.push(error.message);
      return { valid: false, errors };
    }
  }

  /**
   * Create a placeholder call object for testing and development
   * This will be replaced with actual call classes in Phase 2
   * 
   * @private
   * @param {Object} callData - Call configuration data
   * @returns {Object} Placeholder call instance implementing ICall interface
   */
  static _createPlaceholderCall(callData) {
    // Import BaseCall constants to ensure consistency
    const BaseCall = {
      TYPES: CALL_TYPES,
      LEVELS: CALL_LEVELS,
      STATUS: {
        OFFERED: "offered",
        ACCEPTED: "accepted",
        REJECTED: "rejected",
        ENDED: "ended",
        N0_NULL: "N0_NULL",
        N1_INITIATED: "N1_INITIATED",
        N3_ESTABLISHING: "N3_ESTABLISHING",
        N2_ACTIVE: "N2_ACTIVE",
        N4_TERMINATING: "N4_TERMINATING"
      }
    };

    // Create a minimal ICall-compliant object  
    const call = ICall.createMock();

    // Ensure the placeholder has a real unique id and timestamp instead of the static mock id
    const generateId = () => `${callData.type}-${Date.now()}-${Math.random().toString(36).substr(2,9)}`;
    call.id = generateId();
    call.timePlaced = Date.now();

    // Override with call-specific data
    call.type = callData.type;
    call.level = callData.level;

    // Add type-specific properties manually
    if (callData.type === CALL_TYPES.P2P) {
      call.sender = callData.sender;
      call.receivers = callData.receivers;
    } else {
      call.originator = callData.originator;
      call.groupId = callData.groupId;
      call.participants = new Set();
    }
    call.options = callData.options;

    // Override placeholder methods with basic implementations
    call.includesPhone = (phone) => {
      if (callData.type === CALL_TYPES.P2P) {
        return callData.sender.getId() === phone.getId() || 
               callData.receivers.some(r => r.getId() === phone.getId());
      } else {
        return callData.originator.getId() === phone.getId() ||
               (call.participants && Array.from(call.participants).some(p => p.getId() === phone.getId()));
      }
    };

    call.getAllPhones = () => {
      if (callData.type === CALL_TYPES.P2P) {
        return [callData.sender, ...callData.receivers];
      } else {
        return [callData.originator, ...(call.participants ? Array.from(call.participants) : [])];
      }
    };

    call.toEmittable = () => {
      const base = {
        id: call.id,
        timePlaced: call.timePlaced,
        level: call.level,
        status: call.status,
        type: call.type,
        channel: call.channel,
        options: callData.options
      };

      if (callData.type === CALL_TYPES.P2P) {
        return {
          ...base,
          sender: callData.sender.toSimple ? callData.sender.toSimple() : callData.sender,
          receivers: callData.receivers.map(r => r.toSimple ? r.toSimple() : r)
        };
      } else {
        return {
          ...base,
          originator: callData.originator.toSimple ? callData.originator.toSimple() : callData.originator,
          groupId: callData.groupId,
          participants: call.participants ? Array.from(call.participants).map(p => p.toSimple ? p.toSimple() : p) : []
        };
      }
    };

    call.toString = () => `${callData.type}Call(id=${call.id}, type=${call.type}, status=${call.status})`;

    return call;
  }
}

/**
 * CallBuilder - Builder pattern implementation for fluent call creation
 * Provides a fluent interface for constructing calls with complex configurations
 */
export class CallBuilder {
  constructor() {
    this._type = null;
    this._sender = null;
    this._receivers = null;
    this._originator = null;
    this._groupId = null;
    this._level = /** @type {any} */ (CALL_LEVELS.NORMAL);
    this._options = {};
  }

  /**
   * Set call type
   * @param {string} type - Call type
   * @returns {CallBuilder} This builder for chaining
   */
  type(type) {
    this._type = type;
    return this;
  }

  /**
   * Set sender for P2P calls
   * @param {Phone} sender - Sending phone
   * @returns {CallBuilder} This builder for chaining
   */
  sender(sender) {
    this._sender = sender;
    return this;
  }

  /**
   * Set receivers for P2P calls
   * @param {Phone|Phone[]} receivers - Receiving phone(s)
   * @returns {CallBuilder} This builder for chaining
   */
  receivers(receivers) {
    this._receivers = receivers;
    return this;
  }

  /**
   * Set originator for Group/REC calls
   * @param {Phone} originator - Originating phone
   * @returns {CallBuilder} This builder for chaining
   */
  originator(originator) {
    this._originator = originator;
    return this;
  }

  /**
   * Set group ID for Group/REC calls
   * @param {string} groupId - Group identifier
   * @returns {CallBuilder} This builder for chaining
   */
  groupId(groupId) {
    this._groupId = groupId;
    return this;
  }

  /**
   * Set call priority level
   * @param {string} level - Priority level
   * @returns {CallBuilder} This builder for chaining
   */
  level(level) {
    this._level = level;
    return this;
  }

  /**
   * Set call options
   * @param {Object} options - Call options
   * @returns {CallBuilder} This builder for chaining
   */
  options(options) {
    this._options = { ...this._options, ...options };
    return this;
  }

  /**
   * Add a single option
   * @param {string} key - Option key
   * @param {any} value - Option value
   * @returns {CallBuilder} This builder for chaining
   */
  option(key, value) {
    this._options[key] = value;
    return this;
  }

  /**
   * Build the call instance
   * @returns {Object} Created call instance
   * @throws {Error} If required parameters are missing
   */
  build() {
    if (!this._type) {
      throw new Error('Call type must be specified');
    }

    /** @type {any} */
    const params = {
      level: this._level,
      options: this._options
    };

    // Add type-specific parameters
    if (this._type === CALL_TYPES.P2P) {
      if (!this._sender) {
        throw new Error('Sender must be specified for P2P calls');
      }
      params.sender = this._sender;
      params.receivers = this._receivers;
    } else {
      if (!this._originator) {
        throw new Error('Originator must be specified for Group/REC calls');
      }
      params.sender = this._originator; // Use sender field for compatibility
      params.groupId = this._groupId;
    }

    return CallFactory.createCall(this._type, params);
  }
}

/**
 * Convenience functions for common call creation patterns
 */

/**
 * Quick P2P call creation
 * @param {Phone} sender - Sending phone
 * @param {Phone} receiver - Receiving phone
 * @param {string} [level] - Priority level
 * @returns {Object} P2P call instance
 */
export function createQuickP2PCall(sender, receiver, level = CALL_LEVELS.NORMAL) {
  return CallFactory.createP2PCall(sender, receiver, level);
}

/**
 * Quick emergency call creation
 * @param {Phone} originator - Originating phone
 * @param {string} [groupId] - Group identifier
 * @returns {Object} REC call instance
 */
export function createEmergencyCall(originator, groupId = null) {
  return CallFactory.createRECCall(originator, groupId);
}

/**
 * Quick group call creation
 * @param {Phone} originator - Originating phone
 * @param {string} groupId - Group identifier
 * @param {string} [level] - Priority level
 * @returns {Object} Group call instance
 */
export function createQuickGroupCall(originator, groupId, level = CALL_LEVELS.NORMAL) {
  return CallFactory.createGroupCall(originator, groupId, level);
}