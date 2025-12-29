/** @typedef {import("socket.io").Socket} Socket */

/**
 * Base User class that manages connections, calls, and basic functionality
 * All user types (Player, Admin, etc.) should extend this class
 */
export default class User {
  /**
   * Create a new User
   * @param {Socket} socket - Socket.IO connection
   * @param {string} discordId - Discord user ID
   * @param {string} voiceChannelId - Discord voice channel ID
   */
  constructor(socket, discordId, voiceChannelId) {
    // Core identity
    this.socket = socket;
    this.discordId = discordId;
    this.voiceChannelId = voiceChannelId;
    
    // User profile information
    this.avatarURL = "";
    this.displayName = "";
    this.isConnected = true;
    this.role = 'user'; // Overridden by subclasses
    
    // Call-related properties (shared by all user types)
    this.callQueue = {};
    this.inCall = false;
    
    // Connection status tracking
    this.connectionStates = {
      webUI: socket !== null,
      discordVoice: voiceChannelId !== null
    };
  }

  // =========================== CONNECTION MANAGEMENT ===========================

  /**
   * Update the socket connection for this user
   * @param {Socket} socket - New socket connection
   */
  updateSocket(socket) {
    this.socket = socket;
    this.connectionStates.webUI = socket !== null;
    
    if (socket) {
      socket.join(this.discordId);
      socket.discordId = this.discordId;
    }
  }

  /**
   * Update the voice channel for this user
   * @param {string} voiceChannelId - New voice channel ID (null if disconnected)
   */
  updateVoiceChannel(voiceChannelId) {
    this.voiceChannelId = voiceChannelId;
    this.connectionStates.discordVoice = voiceChannelId !== null;
  }

  /**
   * Check if user is fully connected (both web UI and Discord voice)
   * @returns {boolean}
   */
  isFullyConnected() {
    return this.connectionStates.webUI && this.connectionStates.discordVoice;
  }

  /**
   * Update user profile information
   * @param {string} avatarURL - Discord avatar URL
   * @param {string} displayName - Discord display name
   */
  updateProfile(avatarURL, displayName) {
    this.avatarURL = avatarURL;
    this.displayName = displayName;
  }

  // =========================== PERMISSION SYSTEM ===========================
  
  /**
   * Check if user can make calls
   * Base implementation returns false, subclasses should override
   * @returns {boolean}
   */
  canMakeCalls() {
    return false;
  }

  /**
   * Check if user can receive calls
   * Base implementation returns false, subclasses should override
   * @returns {boolean}
   */
  canReceiveCalls() {
    return false;
  }

  /**
   * Check if user can claim panels
   * Base implementation returns false, subclasses should override
   * @returns {boolean}
   */
  canClaimPanel() {
    return false;
  }

  /**
   * Check if user can manage hosts
   * Base implementation returns false, subclasses should override
   * @returns {boolean}
   */
  canManageHosts() {
    return false;
  }

  /**
   * Check if user can manage phones
   * Base implementation returns false, subclasses should override
   * @returns {boolean}
   */
  canManagePhones() {
    return false;
  }

  /**
   * Check if user can view all calls (admin feature)
   * Base implementation returns false, subclasses should override
   * @returns {boolean}
   */
  canViewAllCalls() {
    return false;
  }

  /**
   * Check if user can kick others from calls (admin feature)
   * Base implementation returns false, subclasses should override
   * @returns {boolean}
   */
  canKickFromCalls() {
    return false;
  }

  // =========================== PHONE INTEGRATION ===========================

  /**
   * Get phones assigned to this user
   * Base implementation returns empty array, subclasses should override
   * @returns {Array} Array of Phone objects
   */
  getPhones() {
    return [];
  }

  /**
   * Get phones available for call operations
   * Alias for getPhones() for call system compatibility
   * @returns {Array} Array of Phone objects
   */
  getPhonesForCalls() {
    return this.getPhones();
  }

  // =========================== SERIALIZATION ===========================

  /**
   * Convert user to simple object for client transmission
   * @returns {Object} Simple user representation
   */
  toSimple() {
    return {
      discordId: this.discordId,
      displayName: this.displayName,
      avatarURL: this.avatarURL,
      isConnected: this.isConnected,
      role: this.role
    };
  }

  /**
   * Convert user to detailed object for admin interfaces
   * @returns {Object} Detailed user representation
   */
  toDetailed() {
    return {
      ...this.toSimple(),
      voiceChannelId: this.voiceChannelId,
      connectionStates: this.connectionStates,
      inCall: this.inCall,
      phoneCount: this.getPhones().length
    };
  }

  /**
   * String representation for logging
   * @returns {string}
   */
  toString() {
    return `${this.role}(${this.discordId}:${this.displayName})`;
  }
}