// @ts-check
import crypto from 'crypto';
/** @typedef {import("./phone.js").default} Phone */

/**
 * GroupCallRequest class implementing VGCS FSM states for group call management
 * This class represents a group call using the VGCS architecture instead of the legacy CallRequest
 */
export default class GroupCallRequest {
  static TYPES = { "GROUP": "group", "REC": "REC" };
  static LEVELS = { "NORMAL": "normal", "URGENT": "urgent", "EMERGENCY": "emergency" };
  static STATUS = { 
    "N0_NULL": "N0_NULL",
    "N1_INITIATED": "N1_INITIATED", 
    "N3_ESTABLISHING": "N3_ESTABLISHING",
    "N2_ACTIVE": "N2_ACTIVE",
    "N4_TERMINATING": "N4_TERMINATING"
  };
  
  id;
  /** @type {Phone} */
  originator;
  /** @type {Set<Phone>} */
  participants = new Set();
  /** @type {string} */
  groupId;
  timePlaced;
  level;
  status;
  channel;
  type;
  /** @type {Object} */
  options;
  channelPriority;

  /**
   * @param {Phone} originator 
   * @param {string} groupId
   * @param {string} type 
   * @param {string} level 
   * @param {Object} options 
   */
  constructor(originator, groupId, type = GroupCallRequest.TYPES.GROUP, level = GroupCallRequest.LEVELS.NORMAL, options = {}) {
    this.originator = originator;
    this.groupId = groupId;
    this.type = type;
    this.level = level;
    this.options = {
      priority: level,
      immediateSetup: false,
      autoAnswer: false,
      ...options
    };
    this.id = crypto.randomUUID();
    this.timePlaced = Date.now();
    this.status = GroupCallRequest.STATUS.N0_NULL;
  }

  /**
   * Add a participant to the group call
   * @param {Phone} participant 
   */
  addParticipant(participant) {
    this.participants.add(participant);
  }

  /**
   * Remove a participant from the group call
   * @param {Phone} participant 
   */
  removeParticipant(participant) {
    this.participants.delete(participant);
  }

  /**
   * Get all participants including the originator
   * @returns {Phone[]}
   */
  getAllParticipants() {
    return [this.originator, ...Array.from(this.participants)];
  }

  /**
   * Check if a phone is part of this group call
   * @param {Phone} phone 
   * @returns {boolean}
   */
  includesPhone(phone) {
    return this.originator.getId() === phone.getId() || 
           Array.from(this.participants).some(p => p.getId() === phone.getId());
  }

  /**
   * Check if a phone is the originator of this call
   * @param {Phone} phone 
   * @returns {boolean}
   */
  isOriginator(phone) {
    return this.originator.getId() === phone.getId();
  }

  /**
   * Get the number of participants (excluding originator)
   * @returns {number}
   */
  getParticipantCount() {
    return this.participants.size;
  }

  /**
   * Get the total number of users (including originator)
   * @returns {number}
   */
  getTotalUserCount() {
    return this.participants.size + 1;
  }

  /**
   * Convert to emittable format for socket.io
   * @returns {Object}
   */
  toEmittable() {
    return {
      "id": this.id,
      "groupId": this.groupId,
      "timePlaced": this.timePlaced,
      "level": this.level,
      "status": this.status,
      "type": this.type,
      "originator": this.originator.toSimple(),
      "participants": Array.from(this.participants).map(p => p.toSimple()),
      "participantCount": this.getParticipantCount(),
      "totalUsers": this.getTotalUserCount(),
      "options": this.options,
      "channel": this.channel
    };
  }

  /**
   * Update the VGCS state
   * @param {string} newStatus 
   */
  updateStatus(newStatus) {
    if (Object.values(GroupCallRequest.STATUS).includes(newStatus)) {
      this.status = newStatus;
    } else {
      throw new Error(`Invalid GroupCallRequest status: ${newStatus}`);
    }
  }

  /**
   * Check if the group call is active
   * @returns {boolean}
   */
  isActive() {
    return this.status === GroupCallRequest.STATUS.N2_ACTIVE;
  }

  /**
   * Check if the group call is terminating or terminated
   * @returns {boolean}
   */
  isTerminating() {
    return this.status === GroupCallRequest.STATUS.N4_TERMINATING || 
           this.status === GroupCallRequest.STATUS.N0_NULL;
  }
}
