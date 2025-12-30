import type { ICall } from './PreparedCall';
import { PreparedCall } from './PreparedCall';

/**
 * TypeScript type guards for call type discrimination
 * Provides type safety and discrimination utilities for the unified call system
 */

// Type-specific interfaces extending ICall
export interface IP2PCall extends ICall {
  type: 'p2p';
}

export interface IGroupCall extends ICall {
  type: 'group';
}

export interface IRECCall extends ICall {
  type: 'REC';
  /** Information about the emergency call sender */
  callerInfo?: {
    name: string;
    location?: string;
    id: string;
  };
  /** Auto-join countdown in seconds (for recipients) */
  countdown?: number;
  /** Whether the current user is the sender of this REC call */
  isSender?: boolean;
}

// Union type for all call types
export type AnyCall = IP2PCall | IGroupCall | IRECCall;

/**
 * Type guard for P2P calls
 * @param call - Call object to check
 * @returns True if call is a P2P call
 */
export function isP2PCall(call: ICall): call is IP2PCall {
  return call.type === PreparedCall.TYPES.P2P;
}

/**
 * Type guard for Group calls
 * @param call - Call object to check
 * @returns True if call is a Group call
 */
export function isGroupCall(call: ICall): call is IGroupCall {
  return call.type === PreparedCall.TYPES.GROUP;
}

/**
 * Type guard for REC calls
 * @param call - Call object to check
 * @returns True if call is a REC call
 */
export function isRECCall(call: ICall): call is IRECCall {
  return call.type === PreparedCall.TYPES.REC;
}

/**
 * Type guard for VGCS calls (Group or REC)
 * @param call - Call object to check
 * @returns True if call uses VGCS states
 */
export function isVGCSCall(call: ICall): call is IGroupCall | IRECCall {
  return isGroupCall(call) || isRECCall(call);
}

/**
 * Get call priority for sorting and queue management
 * @param call - Call object
 * @returns Priority number (lower = higher priority)
 */
export function getCallPriority(call: ICall): number {
  // REC calls have highest priority
  if (isRECCall(call)) {
    return 1;
  }
  
  // Emergency calls
  if (call.level === PreparedCall.LEVELS.EMERGENCY) {
    return 2;
  }
  
  // Urgent calls
  if (call.level === PreparedCall.LEVELS.URGENT) {
    return 3;
  }
  
  // Normal calls
  return 4;
}

/**
 * Check if call uses simple states (P2P) or VGCS states (Group/REC)
 * @param call - Call object
 * @returns True if call uses simple state system
 */
export function usesSimpleStates(call: ICall): boolean {
  return isP2PCall(call);
}

/**
 * Check if call uses VGCS states
 * @param call - Call object
 * @returns True if call uses VGCS state system
 */
export function usesVGCSStates(call: ICall): boolean {
  return isVGCSCall(call);
}

/**
 * Get valid status transitions for a call based on its type
 * @param call - Call object
 * @returns Array of valid status values for this call type
 */
export function getValidStatusTransitions(call: ICall): string[] {
  if (usesSimpleStates(call)) {
    return [
      PreparedCall.STATUS.OFFERED,
      PreparedCall.STATUS.ACCEPTED,
      PreparedCall.STATUS.REJECTED,
      PreparedCall.STATUS.ENDED
    ];
  } else {
    return [
      PreparedCall.STATUS.N0_NULL,
      PreparedCall.STATUS.N1_INITIATED,
      PreparedCall.STATUS.N3_ESTABLISHING,
      PreparedCall.STATUS.N2_ACTIVE,
      PreparedCall.STATUS.N4_TERMINATING
    ];
  }
}

/**
 * Validate that a status is valid for a specific call type
 * @param call - Call object
 * @param status - Status to validate
 * @returns True if status is valid for this call type
 */
export function isValidStatusForCallType(call: ICall, status: string): boolean {
  const validStatuses = getValidStatusTransitions(call);
  return validStatuses.includes(status);
}

/**
 * Get CSS class for call type styling
 * @param call - Call object
 * @returns CSS class string for styling
 */
export function getCallTypeClass(call: ICall): string {
  if (isRECCall(call)) {
    return 'call-type-rec';
  } else if (isGroupCall(call)) {
    return 'call-type-group';
  } else {
    return 'call-type-p2p';
  }
}

/**
 * Get CSS class for call priority/level styling
 * @param call - Call object
 * @returns CSS class string for priority styling
 */
export function getCallPriorityClass(call: ICall): string {
  if (call.level === PreparedCall.LEVELS.EMERGENCY) {
    return 'call-priority-emergency';
  } else if (call.level === PreparedCall.LEVELS.URGENT) {
    return 'call-priority-urgent';
  } else {
    return 'call-priority-normal';
  }
}

/**
 * Get CSS class for call status styling
 * @param call - Call object
 * @returns CSS class string for status styling
 */
export function getCallStatusClass(call: ICall): string {
  if (call.isActive()) {
    return 'call-status-active';
  } else if (call.isOffered()) {
    return 'call-status-offered';
  } else if (call.isTerminated()) {
    return 'call-status-terminated';
  } else {
    return 'call-status-unknown';
  }
}