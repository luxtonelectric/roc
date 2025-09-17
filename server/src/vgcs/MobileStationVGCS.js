// @ts-check
import chalk from 'chalk';
import { MSG } from './NetworkGCC.js';

/**
 * MobileStationVGCS - Client-side VGCS finite state machine implementation
 * Handles mobile station behavior for VGCS group calls
 */

// Mobile Station states
export const MS = {
  NULL: "NULL",
  PRESENT: "PRESENT",    // received NOTIFICATION
  CONN_REQ: "CONN_REQ",  // sent JOIN_REQ
  INITIATED: "INITIATED",// originator path
  ACTIVE: "ACTIVE",
  TERM_REQ: "TERM_REQ",
};

export default class MobileStationVGCS {
  /**
   * @param {Object} params
   * @param {string} params.msId - Mobile station identifier
   * @param {import('./VGCSBus.js').default} params.bus - VGCS message bus
   * @param {boolean} params.autoAnswer - Auto-answer incoming calls (REC mode)
   */
  constructor({ msId, bus, autoAnswer = false }) {
    this.id = msId;
    this.bus = bus;
    this.state = MS.NULL;
    this.groupId = null;
    this.isOriginator = false;
    this.autoAnswer = autoAnswer; // REC: true
    this._presentTimer = null;
    
    // Register with the bus
    bus.registerClient(this);
    
    console.log(chalk.green('MobileStationVGCS'), `Created MS: ${msId}, AutoAnswer: ${autoAnswer}`);
  }

  /**
   * Start a group call (originator path)
   * @param {string} groupId 
   * @param {Object} options
   * @param {boolean} options.immediateSetup - Skip establishment phase
   * @param {string} options.priority - Call priority level
   */
  startGroupCall(groupId, { immediateSetup = false, priority = "normal" } = {}) {
    console.log(chalk.yellow('MobileStationVGCS.startGroupCall'), `MS: ${this.id}, GroupId: ${groupId}, State: ${this.state}`);
    
    if (this.state !== MS.NULL) {
      console.log(chalk.red('MobileStationVGCS.startGroupCall'), 'Cannot start - not in NULL state');
      return false;
    }

    this.isOriginator = true;
    this.groupId = groupId;
    this.state = MS.INITIATED;

    console.log(chalk.green('MobileStationVGCS.startGroupCall'), `Starting call with options:`, { immediateSetup, priority, autoAnswer: this.autoAnswer });

    this._send({
      type: MSG.START_REQ,
      fromMs: this.id,
      groupId,
      options: { 
        immediateSetup, 
        priority, 
        autoAnswer: this.autoAnswer 
      }
    });

    return true;
  }

  /**
   * Accept an incoming group call (participant path)
   */
  accept() {
    console.log(chalk.yellow('MobileStationVGCS.accept'), `MS: ${this.id}, State: ${this.state}`);
    
    if (this.state !== MS.PRESENT) {
      console.log(chalk.red('MobileStationVGCS.accept'), 'Cannot accept - not in PRESENT state');
      return false;
    }

    this.state = MS.CONN_REQ;
    this._send({ 
      type: MSG.JOIN_REQ, 
      fromMs: this.id, 
      groupId: this.groupId 
    });

    console.log(chalk.green('MobileStationVGCS.accept'), 'Join request sent');
    return true;
  }

  /**
   * Reject an incoming group call (participant path)
   */
  reject() {
    console.log(chalk.yellow('MobileStationVGCS.reject'), `MS: ${this.id}, State: ${this.state}`);
    
    if (this.state !== MS.PRESENT) {
      console.log(chalk.red('MobileStationVGCS.reject'), 'Cannot reject - not in PRESENT state');
      return false;
    }

    this._clearPresent("user-reject");
    return true;
  }

  /**
   * Leave an active group call (participant path)
   */
  leave() {
    console.log(chalk.yellow('MobileStationVGCS.leave'), `MS: ${this.id}, State: ${this.state}`);
    
    if (this.state !== MS.ACTIVE || this.isOriginator) {
      console.log(chalk.red('MobileStationVGCS.leave'), 'Cannot leave - not active participant');
      return false;
    }

    this._send({ 
      type: MSG.LEAVE, 
      fromMs: this.id, 
      groupId: this.groupId 
    });
    
    // This is a user-initiated leave, not from network release
    this._reset(false);
    console.log(chalk.green('MobileStationVGCS.leave'), 'Left group call');
    return true;
  }

  /**
   * Terminate group call (originator path)
   */
  terminate() {
    console.log(chalk.yellow('MobileStationVGCS.terminate'), `MS: ${this.id}, State: ${this.state}`);
    
    if (!this.isOriginator) {
      console.log(chalk.red('MobileStationVGCS.terminate'), 'Cannot terminate - not originator');
      return false;
    }

    if (![MS.ACTIVE, MS.INITIATED].includes(this.state)) {
      console.log(chalk.red('MobileStationVGCS.terminate'), 'Cannot terminate - invalid state');
      return false;
    }

    this.state = MS.TERM_REQ;
    this._send({ 
      type: MSG.TERMINATE, 
      fromMs: this.id, 
      groupId: this.groupId 
    });

    console.log(chalk.green('MobileStationVGCS.terminate'), 'Termination request sent');
    return true;
  }

  /**
   * Handle incoming VGCS messages
   * @param {Object} msg 
   */
  onMessage(msg) {
    console.log(chalk.cyan('MobileStationVGCS.onMessage'), `MS: ${this.id}, Type: ${msg.type}, State: ${this.state}`);
    
    switch (msg.type) {
      case MSG.NOTIFICATION:
        this._onNotification(msg);
        break;
      case MSG.START_ACK:
        console.log(chalk.green('MobileStationVGCS'), 'Start acknowledged - waiting for CHANNEL_ASSIGN');
        // Wait for CHANNEL_ASSIGN
        break;
      case MSG.JOIN_ACCEPT:
        console.log(chalk.green('MobileStationVGCS'), 'Join accepted - waiting for CHANNEL_ASSIGN');
        // Wait for CHANNEL_ASSIGN
        break;
      case MSG.CHANNEL_ASSIGN:
        this._onChannelAssign(msg);
        break;
      case MSG.WITHDRAWN:
        this._onWithdrawn(msg);
        break;
      case MSG.RELEASE:
        this._onRelease(msg);
        break;
      default:
        console.log(chalk.yellow('MobileStationVGCS'), `Unhandled message type: ${msg.type}`);
    }
  }

  /**
   * Handle NOTIFICATION message
   * @param {Object} msg 
   */
  _onNotification({ groupId, priority, autoAnswer }) {
    console.log(chalk.yellow('MobileStationVGCS._onNotification'), `MS: ${this.id}, GroupId: ${groupId}, State: ${this.state}`);
    
    if (this.state !== MS.NULL) {
      console.log(chalk.yellow('MobileStationVGCS._onNotification'), 'Ignoring - not in NULL state');
      return;
    }

    this.groupId = groupId;
    this.state = MS.PRESENT;

    console.log(chalk.green('MobileStationVGCS._onNotification'), `Call offered - Priority: ${priority}, AutoAnswer: ${this.autoAnswer || autoAnswer}`);

    // Auto-answer for REC calls or if configured
    if (this.autoAnswer || autoAnswer) {
      console.log(chalk.green('MobileStationVGCS._onNotification'), 'Auto-answering call');
      return this.accept();
    }

    // Set timeout for manual answer
    clearTimeout(this._presentTimer);
    this._presentTimer = setTimeout(() => {
      console.log(chalk.yellow('MobileStationVGCS'), 'Present timeout - clearing offer');
      this._clearPresent("timeout");
    }, 4500); // 4.5 seconds for manual answer
  }

  /**
   * Handle CHANNEL_ASSIGN message
   * @param {Object} msg 
   */
  _onChannelAssign({ groupId }) {
    console.log(chalk.yellow('MobileStationVGCS._onChannelAssign'), `MS: ${this.id}, GroupId: ${groupId}, State: ${this.state}`);
    
    if ([MS.CONN_REQ, MS.INITIATED, MS.PRESENT].includes(this.state)) {
      this.state = MS.ACTIVE;
      console.log(chalk.green('MobileStationVGCS._onChannelAssign'), 'Now ACTIVE in group call');
    } else {
      console.log(chalk.yellow('MobileStationVGCS._onChannelAssign'), 'Ignoring - invalid state');
    }
  }

  /**
   * Handle WITHDRAWN message
   * @param {Object} msg 
   */
  _onWithdrawn({ reason }) {
    console.log(chalk.yellow('MobileStationVGCS._onWithdrawn'), `MS: ${this.id}, Reason: ${reason}, State: ${this.state}`);
    
    if ([MS.PRESENT, MS.CONN_REQ, MS.INITIATED].includes(this.state)) {
      console.log(chalk.red('MobileStationVGCS._onWithdrawn'), `Call withdrawn: ${reason}`);
      // This is a network-initiated withdrawal, similar to release
      this._reset(true);
    }
  }

  /**
   * Handle RELEASE message
   * @param {Object} msg 
   */
  _onRelease({ reason }) {
    console.log(chalk.yellow('MobileStationVGCS._onRelease'), `MS: ${this.id}, Reason: ${reason}, State: ${this.state}`);
    
    const validStates = [MS.ACTIVE, MS.TERM_REQ, MS.CONN_REQ, MS.INITIATED, MS.PRESENT];
    if (validStates.includes(this.state)) {
      console.log(chalk.red('MobileStationVGCS._onRelease'), `Call released: ${reason}`);
      // Pass true to indicate this is from a network release (prevents infinite loop)
      this._reset(true);
    }
  }

  /**
   * Get current state information
   * @returns {Object}
   */
  getStateInfo() {
    return {
      id: this.id,
      state: this.state,
      groupId: this.groupId,
      isOriginator: this.isOriginator,
      autoAnswer: this.autoAnswer
    };
  }

  // --- Internal helper methods ---
  
  /**
   * Clear PRESENT state
   * @param {string} reason 
   */
  _clearPresent(reason) {
    console.log(chalk.cyan('MobileStationVGCS._clearPresent'), `MS: ${this.id}, Reason: ${reason}`);
    // This is an autonomous reset (timeout), not from network release
    this._reset(false);
  }
  
  /**
   * Send message via bus
   * @param {Object} payload 
   */
  _send(payload) { 
    this.bus.sendFrom(this.id, payload); 
  }
  
  /**
   * Reset to initial state
   * @param {boolean} fromNetworkRelease - True if reset is due to network release message
   */
  _reset(fromNetworkRelease = false) {
    console.log(chalk.cyan('MobileStationVGCS._reset'), `MS: ${this.id} resetting to NULL (fromNetworkRelease: ${fromNetworkRelease})`);
    
    // Only send termination messages if this is NOT due to a network release
    // (to prevent infinite loops when network releases participants)
    if (!fromNetworkRelease && this.state === MS.ACTIVE && this.groupId) {
      if (this.isOriginator) {
        // Originator should terminate the call
        console.log(chalk.yellow('MobileStationVGCS._reset'), `Terminating group call as originator: ${this.groupId}`);
        this.bus.sendFrom(this.id, {
          type: MSG.TERMINATE,
          groupId: this.groupId
        });
      } else {
        // Participant should leave the call
        console.log(chalk.yellow('MobileStationVGCS._reset'), `Leaving group call as participant: ${this.groupId}`);
        this.bus.sendFrom(this.id, {
          type: MSG.LEAVE,
          groupId: this.groupId
        });
      }
    }
    
    clearTimeout(this._presentTimer);
    this.state = MS.NULL;
    this.groupId = null;
    this.isOriginator = false;
  }
}
