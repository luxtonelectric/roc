// @ts-check
import BaseCall from './BaseCall.js';
import { validateICallInterface } from './ICall.js';
/** @typedef {import("./phone.js").default} Phone */

/**
 * GroupCallRequest - Unified group call model extending BaseCall for GROUP and REC calls 
 * Features:
 * - Extends BaseCall for common functionality
 * - Implements ICall interface specification
 * - Supports GROUP and REC call types with VGCS states
 * - Uses Set for efficient participant management
 * - Provides optimized toEmittable() format
 * - Includes comprehensive VGCS state machine validation
 */
export default class GroupCallRequest extends BaseCall {
  /** @type {Phone} */
  originator;
  /** @type {Set<Phone>} */
  participants = new Set();
  /** @type {string} */
  groupId;
  /** @type {Object} */
  options;
  /** @type {number} */
  channelPriority;

  /**
   * Create a new GroupCallRequest instance for GROUP or REC calls
   * @param {Phone} originator - Phone initiating the group call
   * @param {string} groupId - Group identifier for the call
   * @param {string} [type=BaseCall.TYPES.GROUP] - Call type (GROUP or REC)
   * @param {string} [level=BaseCall.LEVELS.NORMAL] - Call priority level
   * @param {Object} [options={}] - Additional call options
   */
  constructor(originator, groupId, type = BaseCall.TYPES.GROUP, level = BaseCall.LEVELS.NORMAL, options = {}) {
    // Validate group call type
    if (type !== BaseCall.TYPES.GROUP && type !== BaseCall.TYPES.REC) {
      throw new Error(`GroupCallRequest only supports GROUP and REC types, got: ${type}`);
    }

    // Call parent constructor with VGCS initial status
    super(type, level, BaseCall.STATUS.N0_NULL);
    
    // Validate required parameters
    if (!originator) {
      throw new Error('Originator phone is required for GroupCallRequest');
    }
    if (!groupId) {
      throw new Error('Group ID is required for GroupCallRequest');
    }

    // Initialize group call-specific properties
    this.originator = originator;
    this.groupId = groupId;
    this.participants = new Set();
    this.options = {
      priority: level,
      immediateSetup: false,
      autoAnswer: false,
      ...options
    };
    this.channelPriority = this._calculateChannelPriority(level);

    // Validate ICall interface compliance
    if (!validateICallInterface(this)) {
      throw new Error('GroupCallRequest failed ICall interface validation');
    }
  }

  /**
   * Calculate channel priority based on call level
   * @private
   * @param {string} level - Call level
   * @returns {number} Numeric priority for channel allocation
   */
  _calculateChannelPriority(level) {
    const priorities = {
      [BaseCall.LEVELS.EMERGENCY]: 1,
      [BaseCall.LEVELS.URGENT]: 2,
      [BaseCall.LEVELS.NORMAL]: 3
    };
    return priorities[level] || 3;
  }

  /**
   * Override default initial status for group calls (VGCS)
   * @protected
   * @returns {string} N0_NULL status for VGCS calls
   */
  _getDefaultInitialStatus() {
    return BaseCall.STATUS.N0_NULL;
  }

  /**
   * Validate status transitions for VGCS calls
   * Implements VGCS state machine: N0_NULL -> N1_INITIATED -> N3_ESTABLISHING -> N2_ACTIVE -> N4_TERMINATING -> N0_NULL
   * @protected
   * @param {string} currentStatus - Current status
   * @param {string} newStatus - Proposed new status
   * @returns {boolean} True if transition is valid
   */
  _isValidStatusTransition(currentStatus, newStatus) {
    const validTransitions = {
      [BaseCall.STATUS.N0_NULL]: [BaseCall.STATUS.N1_INITIATED],
      [BaseCall.STATUS.N1_INITIATED]: [BaseCall.STATUS.N3_ESTABLISHING, BaseCall.STATUS.N4_TERMINATING, BaseCall.STATUS.N0_NULL],
      [BaseCall.STATUS.N3_ESTABLISHING]: [BaseCall.STATUS.N2_ACTIVE, BaseCall.STATUS.N4_TERMINATING, BaseCall.STATUS.N0_NULL],
      [BaseCall.STATUS.N2_ACTIVE]: [BaseCall.STATUS.N4_TERMINATING, BaseCall.STATUS.N0_NULL],
      [BaseCall.STATUS.N4_TERMINATING]: [BaseCall.STATUS.N0_NULL]
    };

    return validTransitions[currentStatus]?.includes(newStatus) || false;
  }

  /**
   * Add a participant to the group call
   * @param {Phone} participant - Phone to add as participant
   * @throws {Error} If participant is null or already the originator
   */
  addParticipant(participant) {
    if (!participant) {
      throw new Error('Participant cannot be null');
    }
    if (participant.getId() === this.originator.getId()) {
      throw new Error('Originator cannot be added as participant');
    }
    this.participants.add(participant);
  }

  /**
   * Remove a participant from the group call
   * @param {Phone} participant - Phone to remove
   * @returns {boolean} True if participant was removed
   */
  removeParticipant(participant) {
    if (!participant) return false;
    return this.participants.delete(participant);
  }

  /**
   * Get all participants including the originator
   * @returns {Phone[]} Array of all phones in the group call
   */
  getAllParticipants() {
    return [this.originator, ...Array.from(this.participants)];
  }

  /**
   * Implementation of BaseCall abstract method
   * Check if a phone is part of this group call
   * @param {Phone} phone - Phone to check
   * @returns {boolean} True if phone is originator or participant
   */
  includesPhone(phone) {
    if (!phone) return false;
    return this.originator.getId() === phone.getId() || 
           Array.from(this.participants).some(p => p.getId() === phone.getId());
  }

  /**
   * Implementation of BaseCall abstract method
   * Get all phones involved in this call (same as getAllParticipants)
   * @returns {Phone[]} Array of all phones in this call
   */
  getAllPhones() {
    return this.getAllParticipants();
  }

  /**
   * Check if a phone is the originator of this call
   * @param {Phone} phone - Phone to check
   * @returns {boolean} True if phone is the originator
   */
  isOriginator(phone) {
    if (!phone) return false;
    return this.originator.getId() === phone.getId();
  }

  /**
   * Get the number of participants (excluding originator)
   * @returns {number} Number of participants
   */
  getParticipantCount() {
    return this.participants.size;
  }

  /**
   * Get the total number of users (including originator)
   * @returns {number} Total number of users in the call
   */
  getTotalUserCount() {
    return this.participants.size + 1;
  }

  /**
   * Implementation of BaseCall abstract method
   * Convert call to optimized format suitable for socket.io emission
   * @returns {Object} Optimized object for JSON serialization and socket emission
   */
  toEmittable() {
    // Create CallGroup representation for receiver field
    const callGroupData = {
      groupId: this.groupId,
      participants: Array.from(this.participants).map(p => p.toSimple()),
      participantCount: this.getParticipantCount(),
      totalUsers: this.getTotalUserCount(),
      type: this.type === BaseCall.TYPES.REC ? 'REC' : 'GROUP'
    };

    return {
      ...this._getCommonEmittableProperties(),
      groupId: this.groupId,
      sender: this.originator.toSimple(), // Frontend expects 'sender' field
      receiver: callGroupData, // Frontend expects 'receiver' field - CallGroup representation
      originator: this.originator.toSimple(), // Keep for legacy compatibility
      participants: Array.from(this.participants).map(p => p.toSimple()),
      participantCount: this.getParticipantCount(),
      totalUsers: this.getTotalUserCount(),
      options: this.options,
      channelPriority: this.channelPriority,
      // Frontend expects 'target' field - for GROUP calls, it's the groupId string; for REC calls, it's participant phone IDs array
      target: this.type === BaseCall.TYPES.REC 
        ? Array.from(this.participants).map(p => p.getId())  // REC calls: array of phone IDs
        : this.groupId  // GROUP calls: group ID string
    };
  }

  /**
   * Update the VGCS state with validation
   * Overrides BaseCall.updateStatus with additional validation
   * @param {string} newStatus - New VGCS status
   * @throws {Error} If status is invalid for VGCS
   */
  updateStatus(newStatus) {
    // Check if it's a valid VGCS status
    const vgcsStatuses = [
      BaseCall.STATUS.N0_NULL,
      BaseCall.STATUS.N1_INITIATED,
      BaseCall.STATUS.N3_ESTABLISHING,
      BaseCall.STATUS.N2_ACTIVE,
      BaseCall.STATUS.N4_TERMINATING
    ];

    if (!vgcsStatuses.includes(newStatus)) {
      throw new Error(`Invalid VGCS status: ${newStatus}. Must be one of: ${vgcsStatuses.join(', ')}`);
    }

    // Use parent validation
    super.updateStatus(newStatus);
  }

  /**
   * Check if the group call is active
   * @returns {boolean} True if in N2_ACTIVE state
   */
  isActive() {
    return this.status === BaseCall.STATUS.N2_ACTIVE;
  }

  /**
   * Check if the group call is terminating or terminated
   * @returns {boolean} True if in N4_TERMINATING or N0_NULL state
   */
  isTerminating() {
    return this.status === BaseCall.STATUS.N4_TERMINATING || 
           this.status === BaseCall.STATUS.N0_NULL;
  }

  /**
   * Create string representation for debugging
   * @returns {string} String representation
   */
  toString() {
    return `GroupCallRequest(id=${this.id}, type=${this.type}, status=${this.status}, groupId=${this.groupId}, originator=${this.originator.getId()}, participants=${this.participants.size})`;
  }
}
