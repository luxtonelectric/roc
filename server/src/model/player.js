/** @typedef {import("socket.io").Socket} Socket */

import User from './user.js';

/**
 * Player class - extends User with player-specific functionality
 * Players can claim panels, make calls, and operate within simulations
 */
export default class Player extends User {
  /**
   * Create a new Player
   * @param {Socket} socket - Socket.IO connection
   * @param {string} discordId - Discord user ID
   * @param {string} voiceChannelId - Discord voice channel ID
   */
  constructor(socket, discordId, voiceChannelId) {
    super(socket, discordId, voiceChannelId);
    
    // Override role
    this.role = 'player';
    
    // Player-specific properties
    this.sim = "";
    this.panel = null;
  }

  // =========================== PLAYER-SPECIFIC METHODS ===========================

  /**
   * Set the panel this player has claimed
   * @param {Object} panel - Panel object
   */
  setPanel(panel) {
    this.panel = panel;
  }

  /**
   * Get the panel this player has claimed
   * @returns {Object|null} Panel object or null
   */
  getPanel() {
    return this.panel;
  }

  // =========================== PERMISSION OVERRIDES ===========================

  /**
   * Players can make calls
   * @returns {boolean}
   */
  canMakeCalls() {
    return true;
  }

  /**
   * Players can receive calls
   * @returns {boolean}
   */
  canReceiveCalls() {
    return true;
  }

  /**
   * Players can claim panels
   * @returns {boolean}
   */
  canClaimPanel() {
    return true;
  }

  // =========================== PHONE INTEGRATION ===========================

  /**
   * Get phones assigned to this player
   * @returns {Array} Array of Phone objects assigned to this player
   */
  getPhones() {
    // This will be integrated with PhoneManager in Phase 3
    // For now, return empty array to maintain compatibility
    if (global.phoneManager) {
      return global.phoneManager.getPhonesForDiscordId(this.discordId) || [];
    }
    return [];
  }

  // =========================== BACKWARD COMPATIBILITY ===========================

  /**
   * Legacy toSimple method for backward compatibility
   * This method maintains the old format for existing code compatibility
   * @returns {Object} Simple player representation
   */
  toSimple() {
    return {
      'discordId': this.discordId,
      'displayName': this.displayName,
      'avatarURL': this.avatarURL
    };
  }

  /**
   * Override toDetailed to ensure role is included properly
   * Since we override toSimple() for backward compatibility, we need to ensure
   * toDetailed() includes all necessary fields including role
   * @returns {Object} Detailed user representation with player-specific info
   */
  toDetailed() {
    return {
      // Include all base User toSimple fields plus role explicitly
      discordId: this.discordId,
      displayName: this.displayName,
      avatarURL: this.avatarURL,
      isConnected: this.isConnected,
      role: this.role,
      // Include base User toDetailed fields
      voiceChannelId: this.voiceChannelId,
      connectionStates: this.connectionStates,
      inCall: this.inCall,
      phoneCount: this.getPhones().length,
      // Add player-specific fields
      sim: this.sim,
      panel: this.panel
    };
  }
}