/**
 * CallGroup - Server-side model for predefined calling groups
 * Represents groups for GROUP and REC calls, eliminating Phone array passing
 * Mirrors client-side CallGroup.ts for consistent architecture
 */

export default class CallGroup {
  static TYPES = {
    GROUP: "group",
    REC: "REC"
  };

  /** @type {string} */
  #id;
  /** @type {string} */
  #name;
  /** @type {string} */
  #description;
  /** @type {string} */
  #type;
  /** @type {string} */
  #simId;
  /** @type {Array<{id: string, name: string, type: string, status?: string}>} */
  #members;

  /**
   * Create a new CallGroup
   * @param {string} id - Unique group identifier
   * @param {string} name - Display name for the group
   * @param {string} description - Group description
   * @param {string} type - Group type (GROUP or REC)
   * @param {string} simId - Simulation ID this group belongs to
   * @param {Array<{id: string, name: string, type: string, status?: string}>} members - Group members
   */
  constructor(id, name, description, type, simId, members = []) {
    this.#id = id;
    this.#name = name;
    this.#description = description;
    this.#type = type;
    this.#simId = simId;
    this.#members = members;
  }

  // Getters
  get id() { return this.#id; }
  get name() { return this.#name; }
  get description() { return this.#description; }
  get type() { return this.#type; }
  get simId() { return this.#simId; }
  get members() { return [...this.#members]; } // Return copy to prevent mutation

  // Setters
  set name(value) { this.#name = value; }
  set description(value) { this.#description = value; }

  /**
   * Get display name for UI (includes member count)
   * @returns {string}
   */
  getDisplayName() {
    return `${this.#name} (${this.#members.length} members)`;
  }

  /**
   * Get available members only
   * @returns {Array<{id: string, name: string, type: string, status?: string}>}
   */
  getAvailableMembers() {
    return this.#members.filter(member => 
      member.status !== 'offline' && member.status !== 'busy'
    );
  }

  /**
   * Check if group has any available members
   * @returns {boolean}
   */
  hasAvailableMembers() {
    return this.getAvailableMembers().length > 0;
  }

  /**
   * Get member names for display
   * @returns {string}
   */
  getMemberNames() {
    return this.#members.map(m => m.name).join(', ');
  }

  /**
   * Add a member to the group
   * @param {string} id - Member phone ID
   * @param {string} name - Member phone name
   * @param {string} type - Member phone type
   * @param {string} status - Member status (optional)
   */
  addMember(id, name, type, status = 'available') {
    // Check if member already exists
    if (!this.#members.find(m => m.id === id)) {
      this.#members.push({ id, name, type, status });
    }
  }

  /**
   * Remove a member from the group
   * @param {string} id - Member phone ID to remove
   */
  removeMember(id) {
    this.#members = this.#members.filter(m => m.id !== id);
  }

  /**
   * Update member status
   * @param {string} id - Member phone ID
   * @param {string} status - New status
   */
  updateMemberStatus(id, status) {
    const member = this.#members.find(m => m.id === id);
    if (member) {
      member.status = status;
    }
  }

  /**
   * Check if a phone is a member of this group
   * @param {string} phoneId - Phone ID to check
   * @returns {boolean}
   */
  includesPhone(phoneId) {
    return this.#members.some(member => member.id === phoneId);
  }

  /**
   * Get phone IDs of all members
   * @returns {string[]}
   */
  getMemberIds() {
    return this.#members.map(m => m.id);
  }

  /**
   * Convert to simple format for client communication
   * @returns {Object}
   */
  toSimple() {
    return {
      id: this.#id,
      name: this.#name,
      description: this.#description,
      type: this.#type,
      simId: this.#simId,
      members: this.#members,
      memberCount: this.#members.length
    };
  }

  /**
   * Create CallGroup from configuration data
   * @param {Object} data - Group configuration data
   * @returns {CallGroup}
   */
  static fromConfig(data) {
    return new CallGroup(
      data.id,
      data.name,
      data.description || '',
      data.type,
      data.simId,
      data.members || []
    );
  }

  /**
   * Create CallGroup from simple data (from client)
   * @param {Object} data - Simple group data
   * @returns {CallGroup}
   */
  static fromSimple(data) {
    return new CallGroup(
      data.id,
      data.name,
      data.description,
      data.type,
      data.simId,
      data.members || []
    );
  }

  toString() {
    return `CallGroup[${this.#id}] ${this.#name} (${this.#type}) - ${this.#members.length} members`;
  }
}
