/** @typedef {import("socket.io").Socket} Socket */

import User from './user.js';

/**
 * Admin class - extends User with administrative functionality
 * Admins have enhanced permissions for managing hosts, phones, and calls
 */
export default class Admin extends User {
  /**
   * Create a new Admin
   * @param {Socket} socket - Socket.IO connection
   * @param {string} discordId - Discord user ID
   * @param {string} voiceChannelId - Discord voice channel ID
   */
  constructor(socket, discordId, voiceChannelId) {
    super(socket, discordId, voiceChannelId);
    
    // Override role
    this.role = 'admin';
  }

  // =========================== PERMISSION OVERRIDES ===========================

  /**
   * Admins can make calls
   * @returns {boolean}
   */
  canMakeCalls() {
    return true;
  }

  /**
   * Admins can receive calls
   * @returns {boolean}
   */
  canReceiveCalls() {
    return true;
  }

  /**
   * Admins can claim panels
   * @returns {boolean}
   */
  canClaimPanel() {
    return true;
  }

  /**
   * Admins can manage hosts
   * @returns {boolean}
   */
  canManageHosts() {
    return true;
  }

  /**
   * Admins can manage phones
   * @returns {boolean}
   */
  canManagePhones() {
    return true;
  }

  /**
   * Admins can view all calls
   * @returns {boolean}
   */
  canViewAllCalls() {
    return true;
  }

  /**
   * Admins can kick others from calls
   * @returns {boolean}
   */
  canKickFromCalls() {
    return true;
  }

  // =========================== PHONE INTEGRATION ===========================

  /**
   * Get phones assigned to this admin
   * Admins can access phones they've claimed for testing/administration
   * @returns {Array} Array of Phone objects assigned to this admin
   */
  getPhones() {
    // This will be integrated with PhoneManager in Phase 3
    // For now, return empty array to maintain compatibility
    if (global.phoneManager) {
      return global.phoneManager.getPhonesForDiscordId(this.discordId) || [];
    }
    return [];
  }

  // =========================== ADMIN-SPECIFIC METHODS ===========================

  /**
   * Check if this admin is authorized for configuration changes
   * Requires being in superUsers list in config
   * @param {Array} superUsers - Array of authorized Discord IDs from config
   * @returns {boolean}
   */
  isAuthorizedForConfig(superUsers) {
    return superUsers.includes(this.discordId);
  }

  /**
   * Get admin-specific data for admin UI
   * @returns {Object} Admin-specific information
   */
  toAdminData() {
    return {
      ...this.toDetailed(),
      permissions: {
        canManageHosts: this.canManageHosts(),
        canManagePhones: this.canManagePhones(),
        canViewAllCalls: this.canViewAllCalls(),
        canKickFromCalls: this.canKickFromCalls()
      }
    };
  }
}