// @ts-check
import crypto from 'crypto';
/** @typedef {import("./phone.js").default} Phone */

/**
 * BaseCall - Abstract base class for all call types in the unified call interface system
 * Provides common properties and methods shared between P2P calls and Group/REC calls
 * 
 * This class establishes the foundation for the unified call architecture by:
 * - Defining common call properties (id, timePlaced, level, status, type)
 * - Providing shared validation logic for call constants
 * - Implementing common utility methods for call lifecycle management
 * - Establishing the interface contract that all concrete call classes must implement
 * 
 * Design Pattern: Abstract Base Class with Template Method pattern
 * - Common behavior is implemented in the base class
 * - Subclass-specific behavior is delegated to abstract methods
 * - Type safety is enforced through JSDoc and validation utilities
 */
export default class BaseCall {
  // Unified constants for all call types
  static TYPES = {
    "P2P": "p2p",
    "GROUP": "group", 
    "REC": "REC"
  };

  static LEVELS = {
    "NORMAL": "normal",
    "URGENT": "urgent", 
    "EMERGENCY": "emergency"
  };

  // Hybrid status system supporting both simple and VGCS states
  static STATUS = {
    // Simple call states (P2P calls)
    "OFFERED": "offered",
    "ACCEPTED": "accepted", 
    "REJECTED": "rejected",
    "ENDED": "ended",
    
    // VGCS states (Group/REC calls)
    "N0_NULL": "N0_NULL",
    "N1_INITIATED": "N1_INITIATED",
    "N3_ESTABLISHING": "N3_ESTABLISHING", 
    "N2_ACTIVE": "N2_ACTIVE",
    "N4_TERMINATING": "N4_TERMINATING"
  };

  // Core properties shared by all call types
  id;
  timePlaced;
  level; 
  status;
  type;
  channel;

  /**
   * Create a new BaseCall instance
   * @param {string} type - Call type (P2P, GROUP, REC)
   * @param {string} level - Call level (NORMAL, URGENT, EMERGENCY)
   * @param {string} initialStatus - Initial call status
   * @throws {Error} If invalid type or level provided
   */
  constructor(type, level = BaseCall.LEVELS.NORMAL, initialStatus = null) {
    // Prevent direct instantiation of abstract class
    if (this.constructor === BaseCall) {
      throw new Error('BaseCall is an abstract class and cannot be instantiated directly');
    }

    // Validate call type
    if (!Object.values(BaseCall.TYPES).includes(type)) {
      throw new Error(`Invalid call type: ${type}. Must be one of: ${Object.values(BaseCall.TYPES).join(', ')}`);
    }

    // Validate call level  
    if (!Object.values(BaseCall.LEVELS).includes(level)) {
      throw new Error(`Invalid call level: ${level}. Must be one of: ${Object.values(BaseCall.LEVELS).join(', ')}`);
    }

    // Initialize common properties
    this.id = crypto.randomUUID();
    this.timePlaced = Date.now();
    this.type = type;
    this.level = level;
    this.status = initialStatus || this._getDefaultInitialStatus();
    this.channel = null;
  }

  /**
   * Get the default initial status for this call type
   * Subclasses should override this to provide type-specific defaults
   * @protected
   * @returns {string} Default initial status
   */
  _getDefaultInitialStatus() {
    return BaseCall.STATUS.OFFERED;
  }

  /**
   * Update the call status with validation
   * @param {string} newStatus - New status to set
   * @throws {Error} If status is invalid or transition is not allowed
   */
  updateStatus(newStatus) {
    if (!Object.values(BaseCall.STATUS).includes(newStatus)) {
      throw new Error(`Invalid call status: ${newStatus}`);
    }

    // Allow subclasses to validate status transitions
    if (!this._isValidStatusTransition(this.status, newStatus)) {
      throw new Error(`Invalid status transition from ${this.status} to ${newStatus}`);
    }

    this.status = newStatus;
  }

  /**
   * Validate status transitions
   * Subclasses should override this to implement type-specific validation
   * @protected
   * @param {string} currentStatus - Current status
   * @param {string} newStatus - Proposed new status  
   * @returns {boolean} True if transition is valid
   */
  _isValidStatusTransition(currentStatus, newStatus) {
    // Base implementation allows all transitions - subclasses should override
    return true;
  }

  /**
   * Set the Discord voice channel for this call
   * @param {string|null} channelId - Discord channel ID or null to clear
   */
  setChannel(channelId) {
    this.channel = channelId;
  }

  /**
   * Get the Discord voice channel for this call
   * @returns {string|null} Discord channel ID or null if not set
   */
  getChannel() {
    return this.channel;
  }

  /**
   * Check if this call has an active Discord channel
   * @returns {boolean} True if channel is assigned
   */
  hasChannel() {
    return this.channel !== null && this.channel !== undefined;
  }

  /**
   * Check if the call is in an active state
   * @returns {boolean} True if call is active
   */
  isActive() {
    return this.status === BaseCall.STATUS.ACCEPTED || 
           this.status === BaseCall.STATUS.N2_ACTIVE;
  }

  /**
   * Check if the call is in a terminated state
   * @returns {boolean} True if call is terminated
   */
  isTerminated() {
    return this.status === BaseCall.STATUS.ENDED ||
           this.status === BaseCall.STATUS.REJECTED ||
           this.status === BaseCall.STATUS.N0_NULL ||
           this.status === BaseCall.STATUS.N4_TERMINATING;
  }

  /**
   * Check if the call is in an offered/pending state
   * @returns {boolean} True if call is offered/pending
   */
  isOffered() {
    return this.status === BaseCall.STATUS.OFFERED ||
           this.status === BaseCall.STATUS.N1_INITIATED ||
           this.status === BaseCall.STATUS.N3_ESTABLISHING;
  }

  /**
   * Check if a phone is involved in this call
   * Abstract method - must be implemented by subclasses
   * @abstract
   * @param {Phone} phone - Phone to check
   * @returns {boolean} True if phone is involved in this call
   * @throws {Error} If not implemented by subclass
   */
  includesPhone(phone) {
    throw new Error('includesPhone() must be implemented by subclasses');
  }

  /**
   * Get all phones involved in this call
   * Abstract method - must be implemented by subclasses
   * @abstract
   * @returns {Phone[]} Array of all phones in this call
   * @throws {Error} If not implemented by subclass
   */
  getAllPhones() {
    throw new Error('getAllPhones() must be implemented by subclasses');
  }

  /**
   * Convert call to format suitable for socket.io emission
   * Abstract method - must be implemented by subclasses with type-specific data
   * @abstract
   * @returns {Object} Object suitable for JSON serialization and socket emission
   * @throws {Error} If not implemented by subclass
   */
  toEmittable() {
    throw new Error('toEmittable() must be implemented by subclasses');
  }

  /**
   * Get common emittable properties shared by all call types
   * Provides base properties that subclasses can extend
   * @protected
   * @returns {Object} Common properties for emission
   */
  _getCommonEmittableProperties() {
    return {
      id: this.id,
      timePlaced: this.timePlaced,
      level: this.level,
      status: this.status,
      type: this.type,
      channel: this.channel
    };
  }

  /**
   * Create a string representation of the call for debugging
   * @returns {string} String representation
   */
  toString() {
    return `${this.constructor.name}(id=${this.id}, type=${this.type}, status=${this.status}, level=${this.level})`;
  }

  /**
   * Static utility method to validate call constants
   * @param {string} type - Call type to validate
   * @param {string} level - Call level to validate  
   * @param {string} status - Call status to validate
   * @returns {boolean} True if all constants are valid
   */
  static validateConstants(type, level, status) {
    return Object.values(BaseCall.TYPES).includes(type) &&
           Object.values(BaseCall.LEVELS).includes(level) &&
           Object.values(BaseCall.STATUS).includes(status);
  }

  /**
   * Static utility to get all valid types
   * @returns {string[]} Array of valid call types
   */
  static getValidTypes() {
    return Object.values(BaseCall.TYPES);
  }

  /**
   * Static utility to get all valid levels
   * @returns {string[]} Array of valid call levels  
   */
  static getValidLevels() {
    return Object.values(BaseCall.LEVELS);
  }

  /**
   * Static utility to get all valid statuses
   * @returns {string[]} Array of valid call statuses
   */
  static getValidStatuses() {
    return Object.values(BaseCall.STATUS);
  }
}