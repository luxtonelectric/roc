// @ts-check
import BaseCall from './BaseCall.js';
import { validateICallInterface } from './ICall.js';
/** @typedef {import("./phone.js").default} Phone */

/**
 * CallRequest - Unified call model extending BaseCall for P2P calls
 * 
 * This class provides a unified architecture that extends BaseCall and implements 
 * the ICall interface. It supports P2P calls with proper state management and validation.
 * 
 * Features:
 * - Extends BaseCall for common functionality
 * - Implements ICall interface specification
 * - Supports P2P call type with sender/receiver pattern
 * - Provides optimized toEmittable() format
 * - Includes comprehensive validation and error handling
 * - Includes migration utilities for legacy data
 */
export default class CallRequest extends BaseCall {
  /** @type {Phone} */
  sender;
  /** @type {Phone[]} */
  receivers = [];

  /**
   * Create a new CallRequest instance for P2P calls
   * @param {Phone} sender - Phone initiating the call
   * @param {Phone | Phone[]} receiver - Phone(s) receiving the call
   * @param {string} [level=BaseCall.LEVELS.NORMAL] - Call priority level
   * @param {string} [type=BaseCall.TYPES.P2P] - Call type (defaults to P2P)
   */
  constructor(sender, receiver, level = BaseCall.LEVELS.NORMAL, type = BaseCall.TYPES.P2P) {
    // Call parent constructor with proper parameters
    super(type, level);
    
    // Validate required parameters
    if (!sender) {
      throw new Error('Sender phone is required for CallRequest');
    }
    if (!receiver) {
      throw new Error('Receiver phone is required for CallRequest');
    }

    // Initialize P2P-specific properties
    this.sender = sender;
    this.receivers = Array.isArray(receiver) ? receiver : [receiver];

    // Validate ICall interface compliance
    if (!validateICallInterface(this)) {
      throw new Error('CallRequest failed ICall interface validation');
    }
  }



  /**
   * Get the primary receiver for P2P calls
   * @returns {Phone} Primary receiver phone
   * @throws {Error} If not a P2P call or no receiver exists
   */
  getReceiver() {
    if (this.type !== BaseCall.TYPES.P2P) {
      throw new Error('getReceiver() only valid for P2P calls');
    }
    if (this.receivers.length === 0) {
      throw new Error('No receiver found for P2P call');
    }
    return this.receivers[0];
  }

  /**
   * Get all receivers for this call
   * @returns {Phone[]} Array of receiver phones
   */
  getReceivers() {
    return this.receivers;
  }

  /**
   * Set the receiver for P2P calls
   * @param {Phone} receiver - New receiver phone
   * @throws {Error} If not a P2P call
   */
  setReceiver(receiver) {
    if (this.type !== BaseCall.TYPES.P2P) {
      throw new Error('setReceiver() only valid for P2P calls');
    }
    if (!receiver) {
      throw new Error('Receiver phone is required');
    }
    this.receivers = [receiver];
  }

  /**
   * Check if a phone is receiving this call
   * @param {Phone} phone - Phone to check
   * @returns {boolean} True if phone is a receiver
   */
  isForPhone(phone) {
    if (!phone) return false;
    return this.receivers.find((r) => r.getId() === phone.getId()) !== undefined;
  }

  /**
   * Check if a phone is the sender of this call
   * @param {Phone} phone - Phone to check
   * @returns {boolean} True if phone is the sender
   */
  isFromPhone(phone) {
    if (!phone) return false;
    return this.sender.getId() === phone.getId();
  }

  /**
   * Implementation of BaseCall abstract method
   * Check if a phone is involved in this call (sender or receiver)
   * @param {Phone} phone - Phone to check
   * @returns {boolean} True if phone is involved in this call
   */
  includesPhone(phone) {
    return this.isFromPhone(phone) || this.isForPhone(phone);
  }

  /**
   * Implementation of BaseCall abstract method
   * Get all phones involved in this call
   * @returns {Phone[]} Array of all phones (sender + receivers)
   */
  getAllPhones() {
    return [this.sender, ...this.receivers];
  }

  /**
   * Override default initial status for P2P calls
   * @protected
   * @returns {string} OFFERED status for P2P calls
   */
  _getDefaultInitialStatus() {
    return BaseCall.STATUS.OFFERED;
  }

  /**
   * Validate status transitions for P2P calls
   * Implements simple state machine: OFFERED -> ACCEPTED/REJECTED -> ENDED
   * @protected
   * @param {string} currentStatus - Current status
   * @param {string} newStatus - Proposed new status
   * @returns {boolean} True if transition is valid
   */
  _isValidStatusTransition(currentStatus, newStatus) {
    const validTransitions = {
      [BaseCall.STATUS.OFFERED]: [BaseCall.STATUS.ACCEPTED, BaseCall.STATUS.REJECTED, BaseCall.STATUS.ENDED],
      [BaseCall.STATUS.ACCEPTED]: [BaseCall.STATUS.ENDED],
      [BaseCall.STATUS.REJECTED]: [BaseCall.STATUS.ENDED],
      [BaseCall.STATUS.ENDED]: [] // Terminal state
    };

    return validTransitions[currentStatus]?.includes(newStatus) || false;
  }

  /**
   * Implementation of BaseCall abstract method
   * Convert call to optimized format suitable for socket.io emission
   * @returns {Object} Optimized object for JSON serialization and socket emission
   */
  toEmittable() {
    return {
      ...this._getCommonEmittableProperties(),
      sender: this.sender.toSimple(),
      receivers: this.receivers.map((r) => r.toSimple()),
      // Frontend expects 'target' field - for P2P, it's a single receiver phone ID
      target: this.receivers.length > 0 ? this.receivers[0].getId() : null,
      // P2P specific properties (legacy compatibility)
      receiver: this.receivers.length > 0 ? this.receivers[0].toSimple() : null
    };
  }

  /**
   * Create string representation for debugging
   * @returns {string} String representation
   */
  toString() {
    const receiverIds = this.receivers.map(r => r.getId()).join(', ');
    return `CallRequest(id=${this.id}, type=${this.type}, status=${this.status}, sender=${this.sender.getId()}, receivers=[${receiverIds}])`;
  }

  // Legacy compatibility - static constants (deprecated, use BaseCall constants)
  static TYPES = BaseCall.TYPES;
  static LEVELS = BaseCall.LEVELS;
  static STATUS = BaseCall.STATUS;
}