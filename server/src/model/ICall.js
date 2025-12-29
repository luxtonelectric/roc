// @ts-check
import BaseCall from './BaseCall.js';
/** @typedef {import("./phone.js").default} Phone */

/**
 * ICall - Interface specification and validation utilities for the unified call system
 * 
 * This module provides:
 * - Formal interface definition for all call types
 * - Runtime validation utilities for interface compliance
 * - Type guards for discriminating between call types
 * - Contract enforcement for the unified call architecture
 * 
 * The ICall interface ensures that all call implementations (P2P, GROUP, REC)
 * provide consistent behavior and can be used interchangeably in the unified system.
 */

/**
 * ICall interface specification
 * All call implementations must conform to this interface
 * 
 * @interface ICall
 * @property {string} id - Unique call identifier (UUID)
 * @property {number} timePlaced - Timestamp when call was created
 * @property {string} level - Call priority level (NORMAL, URGENT, EMERGENCY)
 * @property {string} status - Current call status (varies by call type)
 * @property {string} type - Call type (P2P, GROUP, REC)
 * @property {string|null} channel - Discord voice channel ID (optional)
 */

/**
 * Required methods that all ICall implementations must provide
 * 
 * @interface ICallMethods
 * @method {function(string): void} updateStatus - Update call status with validation
 * @method {function(string|null): void} setChannel - Set Discord voice channel
 * @method {function(): string|null} getChannel - Get Discord voice channel
 * @method {function(): boolean} hasChannel - Check if channel is assigned
 * @method {function(): boolean} isActive - Check if call is in active state
 * @method {function(): boolean} isTerminated - Check if call is terminated
 * @method {function(): boolean} isOffered - Check if call is offered/pending
 * @method {function(Phone): boolean} includesPhone - Check if phone is involved
 * @method {function(): Phone[]} getAllPhones - Get all phones in call
 * @method {function(): Object} toEmittable - Convert to socket emission format
 * @method {function(): string} toString - String representation for debugging
 */

/**
 * ICall interface validation utility
 * Validates that an object conforms to the ICall interface specification
 * 
 * @param {any} obj - Object to validate
 * @returns {boolean} True if object implements ICall interface
 */
export function validateICallInterface(obj) {
  if (!obj || typeof obj !== 'object') {
    return false;
  }

  // Check required properties
  const requiredProperties = ['id', 'timePlaced', 'level', 'status', 'type'];
  for (const prop of requiredProperties) {
    if (!(prop in obj)) {
      console.warn(`ICall validation failed: missing property '${prop}'`);
      return false;
    }
  }

  // Check property types
  if (typeof obj.id !== 'string') {
    console.warn(`ICall validation failed: 'id' must be string, got ${typeof obj.id}`);
    return false;
  }

  if (typeof obj.timePlaced !== 'number') {
    console.warn(`ICall validation failed: 'timePlaced' must be number, got ${typeof obj.timePlaced}`);
    return false;
  }

  if (typeof obj.level !== 'string') {
    console.warn(`ICall validation failed: 'level' must be string, got ${typeof obj.level}`);
    return false;
  }

  if (typeof obj.status !== 'string') {
    console.warn(`ICall validation failed: 'status' must be string, got ${typeof obj.status}`);
    return false;
  }

  if (typeof obj.type !== 'string') {
    console.warn(`ICall validation failed: 'type' must be string, got ${typeof obj.type}`);
    return false;
  }

  // Validate against BaseCall constants
  if (!BaseCall.getValidTypes().includes(obj.type)) {
    console.warn(`ICall validation failed: invalid type '${obj.type}', must be one of: ${BaseCall.getValidTypes().join(', ')}`);
    return false;
  }

  if (!BaseCall.getValidLevels().includes(obj.level)) {
    console.warn(`ICall validation failed: invalid level '${obj.level}', must be one of: ${BaseCall.getValidLevels().join(', ')}`);
    return false;
  }

  if (!BaseCall.getValidStatuses().includes(obj.status)) {
    console.warn(`ICall validation failed: invalid status '${obj.status}', must be one of: ${BaseCall.getValidStatuses().join(', ')}`);
    return false;
  }

  // Check required methods
  const requiredMethods = [
    'updateStatus', 'setChannel', 'getChannel', 'hasChannel',
    'isActive', 'isTerminated', 'isOffered', 'includesPhone',
    'getAllPhones', 'toEmittable', 'toString'
  ];

  for (const method of requiredMethods) {
    if (typeof obj[method] !== 'function') {
      console.warn(`ICall validation failed: missing or invalid method '${method}'`);
      return false;
    }
  }

  return true;
}

/**
 * Strict ICall interface validation with detailed error reporting
 * Provides comprehensive validation with specific error messages
 * 
 * @param {any} obj - Object to validate
 * @returns {{valid: boolean, errors: string[]}} Validation result with errors
 */
export function validateICallInterfaceStrict(obj) {
  const errors = [];

  if (!obj || typeof obj !== 'object') {
    errors.push('Object must be a non-null object');
    return { valid: false, errors };
  }

  // Property validation
  const requiredProperties = [
    { name: 'id', type: 'string' },
    { name: 'timePlaced', type: 'number' },
    { name: 'level', type: 'string' },
    { name: 'status', type: 'string' },
    { name: 'type', type: 'string' }
  ];

  for (const { name, type } of requiredProperties) {
    if (!(name in obj)) {
      errors.push(`Missing required property: ${name}`);
    } else if (typeof obj[name] !== type) {
      errors.push(`Property '${name}' must be ${type}, got ${typeof obj[name]}`);
    }
  }

  // Constant validation
  if (obj.type && !BaseCall.getValidTypes().includes(obj.type)) {
    errors.push(`Invalid type '${obj.type}', must be one of: ${BaseCall.getValidTypes().join(', ')}`);
  }

  if (obj.level && !BaseCall.getValidLevels().includes(obj.level)) {
    errors.push(`Invalid level '${obj.level}', must be one of: ${BaseCall.getValidLevels().join(', ')}`);
  }

  if (obj.status && !BaseCall.getValidStatuses().includes(obj.status)) {
    errors.push(`Invalid status '${obj.status}', must be one of: ${BaseCall.getValidStatuses().join(', ')}`);
  }

  // Method validation
  const requiredMethods = [
    'updateStatus', 'setChannel', 'getChannel', 'hasChannel',
    'isActive', 'isTerminated', 'isOffered', 'includesPhone',
    'getAllPhones', 'toEmittable', 'toString'
  ];

  for (const method of requiredMethods) {
    if (typeof obj[method] !== 'function') {
      errors.push(`Missing or invalid method: ${method}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Type guard to check if object is a P2P call
 * @param {any} call - Call object to check
 * @returns {boolean} True if call is P2P type
 */
export function isP2PCall(call) {
  return !!(call && call.type === BaseCall.TYPES.P2P);
}

/**
 * Type guard to check if object is a GROUP call
 * @param {any} call - Call object to check
 * @returns {boolean} True if call is GROUP type
 */
export function isGroupCall(call) {
  return !!(call && call.type === BaseCall.TYPES.GROUP);
}

/**
 * Type guard to check if object is a REC call
 * @param {any} call - Call object to check
 * @returns {boolean} True if call is REC type
 */
export function isRECCall(call) {
  return !!(call && call.type === BaseCall.TYPES.REC);
}

/**
 * Type guard to check if object uses VGCS states (GROUP or REC calls)
 * @param {any} call - Call object to check
 * @returns {boolean} True if call uses VGCS state machine
 */
export function isVGCSCall(call) {
  return isGroupCall(call) || isRECCall(call);
}

/**
 * Type guard to check if object uses simple states (P2P calls)
 * @param {any} call - Call object to check
 * @returns {boolean} True if call uses simple state machine
 */
export function isSimpleCall(call) {
  return isP2PCall(call);
}

/**
 * Assert that an object implements the ICall interface
 * Throws an error if validation fails
 * 
 * @param {any} obj - Object to validate
 * @param {string} [context] - Context for error message
 * @throws {Error} If object doesn't implement ICall interface
 */
export function assertICallInterface(obj, context = 'Object') {
  const result = validateICallInterfaceStrict(obj);
  if (!result.valid) {
    throw new Error(`${context} does not implement ICall interface: ${result.errors.join(', ')}`);
  }
}

/**
 * Create a minimal ICall-compatible object for testing
 * Useful for unit tests and mocking
 * 
 * @param {Partial<ICall>} overrides - Properties to override
 * @returns {Object} Minimal ICall-compatible object
 */
export function createMockICall(overrides = {}) {
  const mockMethods = {
    updateStatus: () => {},
    setChannel: () => {},
    getChannel: () => null,
    hasChannel: () => false,
    isActive: () => false,
    isTerminated: () => false,
    isOffered: () => true,
    includesPhone: () => false,
    getAllPhones: () => [],
    toEmittable: () => ({}),
    toString: () => 'MockCall'
  };

  return {
    id: 'mock-call-id',
    timePlaced: Date.now(),
    level: BaseCall.LEVELS.NORMAL,
    status: BaseCall.STATUS.OFFERED,
    type: BaseCall.TYPES.P2P,
    channel: null,
    ...mockMethods,
    ...overrides
  };
}

/**
 * ICall interface constants and utilities
 */
export const ICall = {
  // Re-export BaseCall constants for convenience
  TYPES: BaseCall.TYPES,
  LEVELS: BaseCall.LEVELS,
  STATUS: BaseCall.STATUS,
  
  // Validation functions
  validate: validateICallInterface,
  validateStrict: validateICallInterfaceStrict,
  assert: assertICallInterface,
  
  // Type guards
  isP2P: isP2PCall,
  isGroup: isGroupCall,
  isREC: isRECCall,
  isVGCS: isVGCSCall,
  isSimple: isSimpleCall,
  
  // Testing utilities
  createMock: createMockICall
};