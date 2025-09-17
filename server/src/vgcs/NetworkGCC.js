// @ts-check
import chalk from 'chalk';

/**
 * NetworkGCC - Server-side VGCS finite state machine implementation
 * Handles group call state management according to VGCS FSM specification
 */

// VGCS Message types
export const MSG = {
  NOTIFICATION: "GCC.NOTIFICATION",
  START_REQ: "GCC.START_REQ",
  START_ACK: "GCC.START_ACK",
  JOIN_REQ: "GCC.JOIN_REQ",
  JOIN_ACCEPT: "GCC.JOIN_ACCEPT",
  CHANNEL_ASSIGN: "GCC.CHANNEL_ASSIGN",
  LEAVE: "GCC.LEAVE",
  TERMINATE: "GCC.TERMINATE",
  RELEASE: "GCC.RELEASE",
  WITHDRAWN: "GCC.WITHDRAWN"
};

// Network states
export const NET = {
  N0_NULL: "N0_NULL",
  N1_INITIATED: "N1_INITIATED",
  N3_ESTABLISHING: "N3_ESTABLISHING",
  N2_ACTIVE: "N2_ACTIVE",
  N4_TERMINATING: "N4_TERMINATING",
};

// Timer constants (in milliseconds)
export const Timers = {
  T_PRESENT: 5000,   // notification validity before withdrawal (non-immediate)
  T_SETUP: 3000,     // time to establish resources (non-immediate)
  T_IDLE: 20000,     // idle/no-user auto-clear
};

export default class NetworkGCC {
  /**
   * @param {import('./VGCSBus.js').default} bus 
   */
  constructor(bus) {
    this.bus = bus;
    this.state = NET.N0_NULL;
    this.groupId = null;
    this.originator = null;
    this.participants = new Set();
    this.cells = new Set(); // opaque cell management
    this.options = { 
      priority: "normal", 
      immediateSetup: false, 
      autoAnswer: false 
    };
    this._presentTimer = null;
    this._idleTimer = null;
    this._setupTimer = null;
  }

  /**
   * Handle START_REQ from originator mobile station
   * @param {Object} params
   * @param {string} params.fromMs - Mobile station ID
   * @param {string} params.groupId - Group call ID
   * @param {Object} params.options - Call options
   */
  onStartReq({ fromMs, groupId, options = {} }) {
    console.log(chalk.yellow('NetworkGCC.onStartReq'), `From: ${fromMs}, GroupId: ${groupId}, State: ${this.state}`);
    
    if (this.state !== NET.N0_NULL) {
      console.log(chalk.yellow('NetworkGCC.onStartReq'), 'Rejecting - network busy');
      return this._rejectStart(fromMs, "busy");
    }

    this.state = NET.N1_INITIATED;
    this.groupId = groupId;
    this.originator = fromMs;
    this.options = { ...this.options, ...options };

    console.log(chalk.green('NetworkGCC.onStartReq'), `Call initiated - GroupId: ${groupId}, Options:`, this.options);

    // Notify area of new group call
    this._broadcast({ 
      type: MSG.NOTIFICATION, 
      groupId, 
      priority: this.options.priority,
      autoAnswer: this.options.autoAnswer
    });

    // Establish resources based on setup mode
    this._gotoEstablishingThenActive(!!this.options.immediateSetup);

    // Acknowledge originator
    this._send(fromMs, { type: MSG.START_ACK, groupId });
  }

  /**
   * Handle JOIN_REQ from participant mobile station
   * @param {Object} params
   * @param {string} params.fromMs - Mobile station ID
   */
  onJoinReq({ fromMs }) {
    console.log(chalk.yellow('NetworkGCC.onJoinReq'), `From: ${fromMs}, State: ${this.state}`);
    
    // Allow JOIN_REQ in INITIATED state for immediate setup calls (REC calls)
    // and in ESTABLISHING/ACTIVE states for normal calls
    const validStates = [NET.N3_ESTABLISHING, NET.N2_ACTIVE];
    if (this.options.immediateSetup) {
      validStates.push(NET.N1_INITIATED);
    }
    
    if (!validStates.includes(this.state)) {
      console.log(chalk.red('NetworkGCC.onJoinReq'), 'Rejecting - no active call');
      return this._send(fromMs, { type: MSG.WITHDRAWN, reason: "no-call" });
    }

    this.participants.add(fromMs);
    console.log(chalk.green('NetworkGCC.onJoinReq'), `Participant added: ${fromMs}, Total participants: ${this.participants.size}`);

    // Send JOIN_ACCEPT immediately
    this._send(fromMs, { type: MSG.JOIN_ACCEPT, groupId: this.groupId });

    // If already active, send CHANNEL_ASSIGN immediately
    if (this.state === NET.N2_ACTIVE) {
      this._send(fromMs, { type: MSG.CHANNEL_ASSIGN, groupId: this.groupId });
    }
    // Otherwise, CHANNEL_ASSIGN will be sent when transitioning to ACTIVE

    this._armIdleTimer();
  }

  /**
   * Handle LEAVE from participant mobile station
   * @param {Object} params
   * @param {string} params.fromMs - Mobile station ID
   */
  onLeave({ fromMs }) {
    console.log(chalk.yellow('NetworkGCC.onLeave'), `From: ${fromMs}, State: ${this.state}`);
    
    const wasParticipant = this.participants.delete(fromMs);
    if (wasParticipant) {
      console.log(chalk.green('NetworkGCC.onLeave'), `Participant removed: ${fromMs}, Remaining: ${this.participants.size}`);
    }

    // Check if we should reset after participant leaves
    this._checkNetworkReset();
    
    this._armIdleTimer();
  }

  /**
   * Handle TERMINATE from originator or controller
   * @param {Object} params
   * @param {string} params.fromMs - Mobile station ID
   */
  onTerminate({ fromMs }) {
    console.log(chalk.yellow('NetworkGCC.onTerminate'), `From: ${fromMs}, State: ${this.state}`);
    
    if (this.state === NET.N0_NULL) {
      console.log(chalk.yellow('NetworkGCC.onTerminate'), 'Ignoring - no active call');
      return;
    }

    // Authorization check
    if (fromMs !== this.originator && !this._isController(fromMs)) {
      console.log(chalk.red('NetworkGCC.onTerminate'), `Unauthorized termination attempt from: ${fromMs}`);
      return;
    }

    console.log(chalk.green('NetworkGCC.onTerminate'), 'Terminating group call');
    this.state = NET.N4_TERMINATING;
    this._releaseAll("terminated");
  }

  /**
   * Internal: transition to establishing then active state
   * @param {boolean} isImmediate 
   */
  _gotoEstablishingThenActive(isImmediate) {
    console.log(chalk.cyan('NetworkGCC._gotoEstablishingThenActive'), `Immediate: ${isImmediate}`);
    
    this.state = NET.N3_ESTABLISHING;

    if (!isImmediate) {
      // Set up withdrawal timer for non-immediate calls
      clearTimeout(this._presentTimer);
      this._presentTimer = setTimeout(() => {
        if (this.state === NET.N3_ESTABLISHING) {
          console.log(chalk.yellow('NetworkGCC'), 'Present timer expired - withdrawing call');
          this._broadcast({ type: MSG.WITHDRAWN, groupId: this.groupId, reason: "timeout" });
          this._reset();
        }
      }, Timers.T_PRESENT);
    }

    // Set up resource establishment timer
    const setupDelay = isImmediate ? 100 : Timers.T_SETUP;
    clearTimeout(this._setupTimer);
    this._setupTimer = setTimeout(() => {
      if (![NET.N3_ESTABLISHING, NET.N1_INITIATED].includes(this.state)) {
        console.log(chalk.yellow('NetworkGCC'), 'Setup timer fired but state changed');
        return;
      }

      console.log(chalk.green('NetworkGCC'), 'Transitioning to ACTIVE state');
      this.state = NET.N2_ACTIVE;

      // Send CHANNEL_ASSIGN to all participants including originator
      const targets = new Set(this.participants);
      if (this.originator) targets.add(this.originator);

      for (const ms of targets) {
        this._send(ms, { type: MSG.CHANNEL_ASSIGN, groupId: this.groupId });
      }

      this._armIdleTimer();
    }, setupDelay);
  }

  /**
   * Internal: set up idle timer for automatic cleanup
   */
  _armIdleTimer() {
    clearTimeout(this._idleTimer);
    this._idleTimer = setTimeout(() => {
      if (this.state !== NET.N2_ACTIVE) return;
      
      const noUsers = this.participants.size === 0 && !this._originatorOnline();
      if (noUsers) {
        console.log(chalk.yellow('NetworkGCC'), 'Idle timeout - clearing empty call');
        this.state = NET.N4_TERMINATING;
        this._releaseAll("idle-timeout");
      }
    }, Timers.T_IDLE);
  }

  /**
   * Internal: release all participants and reset
   * @param {string} reason 
   */
  _releaseAll(reason) {
    console.log(chalk.red('NetworkGCC._releaseAll'), `Reason: ${reason}`);
    this._broadcast({ type: MSG.RELEASE, groupId: this.groupId, reason });
    this._reset();
  }

  /**
   * Internal: reset to initial state
   */
  _reset() {
    console.log(chalk.cyan('NetworkGCC._reset'), 'Resetting to NULL state');
    
    const groupId = this.groupId; // Save before clearing
    
    clearTimeout(this._presentTimer);
    clearTimeout(this._idleTimer);
    clearTimeout(this._setupTimer);
    
    this.state = NET.N0_NULL;
    this.groupId = null;
    this.originator = null;
    this.participants.clear();
    this.options = { 
      priority: "normal", 
      immediateSetup: false, 
      autoAnswer: false 
    };

    // Notify bus to clean up this network instance
    if (groupId && this.bus && typeof this.bus._removeNetworkForGroup === 'function') {
      this.bus._removeNetworkForGroup(groupId);
    }
  }

  /**
   * Get current state information
   * @returns {Object}
   */
  getStateInfo() {
    return {
      state: this.state,
      groupId: this.groupId,
      originator: this.originator,
      participants: Array.from(this.participants),
      participantCount: this.participants.size,
      options: { ...this.options }
    };
  }

  // --- Internal helper methods ---
  
  /**
   * Send message to specific mobile station
   * @param {string} ms 
   * @param {Object} payload 
   */
  _send(ms, payload) { 
    this.bus.sendTo(ms, payload); 
  }
  
  /**
   * Broadcast message to all participants
   * @param {Object} payload 
   */
  _broadcast(payload) { 
    this.bus.broadcast(this.groupId, payload); 
  }
  
  /**
   * Reject start request
   * @param {string} ms 
   * @param {string} reason 
   */
  _rejectStart(ms, reason) { 
    this._send(ms, { type: MSG.WITHDRAWN, reason }); 
    
    // Check if network should be reset after rejection
    this._checkNetworkReset();
  }

  /**
   * Check if the network should be reset due to no active participants
   */
  _checkNetworkReset() {
    if (this.state === NET.N0_NULL) {
      return; // Already in NULL state
    }

    // If no originator or originator offline, and no participants, reset
    const hasActiveOriginator = this.originator && this.bus.isOnline(this.originator);
    const hasActiveParticipants = Array.from(this.participants).some(p => this.bus.isOnline(p));

    if (!hasActiveOriginator && !hasActiveParticipants) {
      console.log(chalk.yellow('NetworkGCC._checkNetworkReset'), 'No active participants - resetting network');
      this._reset();
    }
  }
  
  /**
   * Check if mobile station is a controller
   * @param {string} ms 
   * @returns {boolean}
   */
  _isController(ms) { 
    return this.bus.isController(ms); 
  }
  
  /**
   * Check if originator is online
   * @returns {boolean}
   */
  _originatorOnline() { 
    return this.bus.isOnline(this.originator); 
  }
}
