// @ts-check

/**
 * CallConstants - Unified constants module for all call types, levels, and statuses
 * 
 * This module provides centralized constant definitions that are shared across:
 * - Server-side call models (CallRequest, GroupCallRequest, BaseCall)
 * - Client-side call models (PreparedCall, ICall TypeScript interfaces)
 * - Call managers and socket event handlers
 * - Test suites and validation utilities
 * 
 * By centralizing these constants, we ensure consistency across the entire
 * unified call interface system and prevent synchronization issues between
 * client and server implementations.
 */

/**
 * Call Types - Unified definition for all supported call types
 * These constants are used throughout the system to identify call behavior
 */
export const CALL_TYPES = Object.freeze({
  /** Point-to-point call between two phones */
  P2P: "p2p",
  
  /** Group call supporting multiple participants */
  GROUP: "group",
  
  /** Railway Emergency Call with special priority and behavior */
  REC: "REC"
});

/**
 * Call Priority Levels - Unified priority system for all call types
 * These levels affect call queuing, audio notifications, and UI presentation
 */
export const CALL_LEVELS = Object.freeze({
  /** Standard priority call */
  NORMAL: "normal",
  
  /** Elevated priority call requiring attention */
  URGENT: "urgent",
  
  /** Highest priority call requiring immediate response */
  EMERGENCY: "emergency"
});

/**
 * Call Status Values - Hybrid status system supporting both simple and VGCS states
 * 
 * Simple States (P2P calls):
 * - OFFERED: Call has been placed and is ringing
 * - ACCEPTED: Call has been answered and is in progress
 * - REJECTED: Call was declined by recipient
 * - ENDED: Call was terminated by either party
 * 
 * VGCS States (Group/REC calls):
 * - N0_NULL: Call does not exist or has been fully terminated
 * - N1_INITIATED: Call setup has begun, participants being notified
 * - N3_ESTABLISHING: Call infrastructure is being established
 * - N2_ACTIVE: Call is active with participants connected
 * - N4_TERMINATING: Call is being torn down
 */
export const CALL_STATUS = Object.freeze({
  // Simple call states (P2P)
  OFFERED: "offered",
  ACCEPTED: "accepted",
  REJECTED: "rejected", 
  ENDED: "ended",
  
  // VGCS call states (Group/REC)
  N0_NULL: "N0_NULL",
  N1_INITIATED: "N1_INITIATED",
  N3_ESTABLISHING: "N3_ESTABLISHING",
  N2_ACTIVE: "N2_ACTIVE", 
  N4_TERMINATING: "N4_TERMINATING"
});

/**
 * Status Categories - Logical groupings of status values for easier state checking
 */
export const STATUS_CATEGORIES = Object.freeze({
  /** Statuses indicating an active, ongoing call */
  ACTIVE: [CALL_STATUS.ACCEPTED, CALL_STATUS.N2_ACTIVE],
  
  /** Statuses indicating a call that is offered but not yet active */
  OFFERED: [CALL_STATUS.OFFERED, CALL_STATUS.N1_INITIATED, CALL_STATUS.N3_ESTABLISHING],
  
  /** Statuses indicating a terminated or ended call */
  TERMINATED: [CALL_STATUS.ENDED, CALL_STATUS.REJECTED, CALL_STATUS.N0_NULL, CALL_STATUS.N4_TERMINATING],
  
  /** Statuses used only by simple calls (P2P) */
  SIMPLE_ONLY: [CALL_STATUS.OFFERED, CALL_STATUS.ACCEPTED, CALL_STATUS.REJECTED, CALL_STATUS.ENDED],
  
  /** Statuses used only by VGCS calls (Group/REC) */
  VGCS_ONLY: [CALL_STATUS.N0_NULL, CALL_STATUS.N1_INITIATED, CALL_STATUS.N3_ESTABLISHING, CALL_STATUS.N2_ACTIVE, CALL_STATUS.N4_TERMINATING]
});

/**
 * Valid Status Transitions - Defines allowed state transitions for each call type
 * This helps prevent invalid state changes and ensures proper call lifecycle management
 */
export const STATUS_TRANSITIONS = Object.freeze({
  /** Valid transitions for P2P calls */
  P2P: {
    [CALL_STATUS.OFFERED]: [CALL_STATUS.ACCEPTED, CALL_STATUS.REJECTED, CALL_STATUS.ENDED],
    [CALL_STATUS.ACCEPTED]: [CALL_STATUS.ENDED],
    [CALL_STATUS.REJECTED]: [], // Terminal state
    [CALL_STATUS.ENDED]: [] // Terminal state
  },
  
  /** Valid transitions for Group calls */
  GROUP: {
    [CALL_STATUS.N0_NULL]: [CALL_STATUS.N1_INITIATED],
    [CALL_STATUS.N1_INITIATED]: [CALL_STATUS.N3_ESTABLISHING, CALL_STATUS.N0_NULL],
    [CALL_STATUS.N3_ESTABLISHING]: [CALL_STATUS.N2_ACTIVE, CALL_STATUS.N4_TERMINATING],
    [CALL_STATUS.N2_ACTIVE]: [CALL_STATUS.N4_TERMINATING],
    [CALL_STATUS.N4_TERMINATING]: [CALL_STATUS.N0_NULL]
  },
  
  /** Valid transitions for REC calls (same as GROUP but with stricter rules) */
  REC: {
    [CALL_STATUS.N0_NULL]: [CALL_STATUS.N1_INITIATED],
    [CALL_STATUS.N1_INITIATED]: [CALL_STATUS.N3_ESTABLISHING, CALL_STATUS.N0_NULL],
    [CALL_STATUS.N3_ESTABLISHING]: [CALL_STATUS.N2_ACTIVE, CALL_STATUS.N4_TERMINATING],
    [CALL_STATUS.N2_ACTIVE]: [CALL_STATUS.N4_TERMINATING],
    [CALL_STATUS.N4_TERMINATING]: [CALL_STATUS.N0_NULL]
  }
});

/**
 * Call Type Metadata - Additional information about each call type
 */
export const CALL_TYPE_METADATA = Object.freeze({
  [CALL_TYPES.P2P]: {
    name: "Point-to-Point",
    description: "Direct call between two phones",
    maxParticipants: 2,
    requiresVGCS: false,
    statusSystem: "simple",
    defaultLevel: CALL_LEVELS.NORMAL,
    allowedLevels: [CALL_LEVELS.NORMAL, CALL_LEVELS.URGENT, CALL_LEVELS.EMERGENCY]
  },
  
  [CALL_TYPES.GROUP]: {
    name: "Group Call", 
    description: "Multi-party conference call",
    maxParticipants: null, // Unlimited
    requiresVGCS: true,
    statusSystem: "vgcs",
    defaultLevel: CALL_LEVELS.NORMAL,
    allowedLevels: [CALL_LEVELS.NORMAL, CALL_LEVELS.URGENT, CALL_LEVELS.EMERGENCY]
  },
  
  [CALL_TYPES.REC]: {
    name: "Railway Emergency Call",
    description: "Emergency call with special procedures and priority",
    maxParticipants: null, // Unlimited
    requiresVGCS: true, 
    statusSystem: "vgcs",
    defaultLevel: CALL_LEVELS.EMERGENCY,
    allowedLevels: [CALL_LEVELS.EMERGENCY] // REC calls are always emergency priority
  }
});

/**
 * Validation Utilities - Helper functions for validating constants
 */

/**
 * Check if a call type is valid
 * @param {any} type - Call type to validate
 * @returns {boolean} True if valid
 */
export function isValidCallType(type) {
  return Object.values(CALL_TYPES).includes(/** @type {any} */ (type));
}

/**
 * Check if a call level is valid
 * @param {any} level - Call level to validate
 * @returns {boolean} True if valid
 */
export function isValidCallLevel(level) {
  return Object.values(CALL_LEVELS).includes(/** @type {any} */ (level));
}

/**
 * Check if a call status is valid
 * @param {any} status - Call status to validate
 * @returns {boolean} True if valid
 */
export function isValidCallStatus(status) {
  return Object.values(CALL_STATUS).includes(/** @type {any} */ (status));
}

/**
 * Check if a level is allowed for a specific call type
 * @param {string} type - Call type
 * @param {string} level - Call level to check
 * @returns {boolean} True if level is allowed for this type
 */
export function isLevelAllowedForType(type, level) {
  const metadata = CALL_TYPE_METADATA[type];
  return metadata && metadata.allowedLevels.includes(level);
}

/**
 * Check if a status transition is valid for a call type
 * @param {string} type - Call type
 * @param {string} fromStatus - Current status
 * @param {string} toStatus - Desired status
 * @returns {boolean} True if transition is valid
 */
export function isValidStatusTransition(type, fromStatus, toStatus) {
  const transitions = STATUS_TRANSITIONS[type];
  return transitions && 
         transitions[fromStatus] && 
         transitions[fromStatus].includes(toStatus);
}

/**
 * Check if a status is active (call in progress)
 * @param {any} status - Status to check
 * @returns {boolean} True if status indicates active call
 */
export function isActiveStatus(status) {
  return STATUS_CATEGORIES.ACTIVE.includes(/** @type {any} */ (status));
}

/**
 * Check if a status is offered (call pending)
 * @param {any} status - Status to check
 * @returns {boolean} True if status indicates offered call
 */
export function isOfferedStatus(status) {
  return STATUS_CATEGORIES.OFFERED.includes(/** @type {any} */ (status));
}

/**
 * Check if a status is terminated (call ended)
 * @param {any} status - Status to check
 * @returns {boolean} True if status indicates terminated call
 */
export function isTerminatedStatus(status) {
  return STATUS_CATEGORIES.TERMINATED.includes(/** @type {any} */ (status));
}

/**
 * Check if a call type uses VGCS status system
 * @param {string} type - Call type to check
 * @returns {boolean} True if type uses VGCS
 */
export function usesVGCSStatus(type) {
  const metadata = CALL_TYPE_METADATA[type];
  return metadata && metadata.requiresVGCS;
}

/**
 * Get the default initial status for a call type
 * @param {string} type - Call type
 * @returns {string} Default initial status
 */
export function getDefaultInitialStatus(type) {
  return usesVGCSStatus(type) ? CALL_STATUS.N0_NULL : CALL_STATUS.OFFERED;
}

/**
 * Get all valid statuses for a call type
 * @param {string} type - Call type  
 * @returns {string[]} Array of valid statuses for this type
 */
export function getValidStatusesForType(type) {
  return usesVGCSStatus(type) ? STATUS_CATEGORIES.VGCS_ONLY : STATUS_CATEGORIES.SIMPLE_ONLY;
}

/**
 * Legacy compatibility - Provides backward compatibility with existing code
 * These exports match the structure of the original CallRequest and GroupCallRequest classes
 */
export const LEGACY_COMPAT = Object.freeze({
  // CallRequest-style exports
  CallRequest: {
    TYPES: CALL_TYPES,
    LEVELS: CALL_LEVELS,
    STATUS: {
      OFFERED: CALL_STATUS.OFFERED,
      ACCEPTED: CALL_STATUS.ACCEPTED,
      REJECTED: CALL_STATUS.REJECTED,
      ENDED: CALL_STATUS.ENDED
    }
  },
  
  // GroupCallRequest-style exports
  GroupCallRequest: {
    TYPES: {
      GROUP: CALL_TYPES.GROUP,
      REC: CALL_TYPES.REC
    },
    LEVELS: CALL_LEVELS,
    STATUS: {
      N0_NULL: CALL_STATUS.N0_NULL,
      N1_INITIATED: CALL_STATUS.N1_INITIATED,
      N3_ESTABLISHING: CALL_STATUS.N3_ESTABLISHING,
      N2_ACTIVE: CALL_STATUS.N2_ACTIVE,
      N4_TERMINATING: CALL_STATUS.N4_TERMINATING
    }
  }
});