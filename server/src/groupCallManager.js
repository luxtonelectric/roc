// @ts-check
import chalk from 'chalk';
import GroupCallRequest from './model/groupcallrequest.js';
import CallRequest from './model/callrequest.js';
import VGCSBus from './vgcs/VGCSBus.js';
import MobileStationVGCS from './vgcs/MobileStationVGCS.js';
import VGCSSocketBridge from './vgcs/VGCSSocketBridge.js';

/** @typedef {import("./model/phone.js").default} Phone */
/** @typedef {import("./phonemanager.js").default} PhoneManager */
/** @typedef {import("./bot.js").default} DiscordBot */
/** @typedef {import("./callManager.js").default} CallManager */
/** @typedef {import("socket.io").Server} Server */

/**
 * GroupCallManager - Manages VGCS-based group calls including REC calls
 * Integrates VGCS components with ROC socket.io infrastructure
 */
export default class GroupCallManager {
  /**
   * @param {PhoneManager} phoneManager 
   * @param {DiscordBot} bot 
   * @param {Server} io 
   */
  constructor(phoneManager, bot, io) {
    this.phoneManager = phoneManager;
    this.bot = bot;
    this.io = io;
    
    /** @type {VGCSBus} */
    this.vgcsBus = new VGCSBus();
    
    /** @type {VGCSSocketBridge} */
    this.socketBridge = new VGCSSocketBridge(this, io);
    
    /** @type {Map<string, GroupCallRequest>} */
    this.activeGroupCalls = new Map(); // groupId -> GroupCallRequest
    
    /** @type {Map<string, MobileStationVGCS>} */
    this.mobileStations = new Map(); // phoneId -> MobileStationVGCS
    
    /** @type {Map<string, string>} */
    this.phoneToGroupMap = new Map(); // phoneId -> groupId
    
    /** @type {CallManager|null} */
    this.callManager = null;
    
    console.log(chalk.green('GroupCallManager'), 'Group Call Manager initialized');
    
    this.setupErrorHandling();
    this.initializeVGCSBridge();
  }

  /**
   * Set up error handling for VGCS message failures and socket disconnections
   */
  setupErrorHandling() {
    process.on('uncaughtException', (error) => {
      if (error.message && error.message.includes('VGCS')) {
        this.handleVGCSError(error);
      }
    });

    if (this.io && typeof this.io.on === 'function') {
      this.io.on('disconnect', (socket) => {
        this.handleSocketDisconnection(socket).catch(() => {});
      });
    }
  }

  /**
   * Initialize VGCS Socket Bridge integration
   */
  initializeVGCSBridge() {
    if (!this.socketBridge) {
      return;
    }

    this.vgcsBus.setSocketBridge(this.socketBridge);
  }

  /**
   * Handle VGCS system errors with recovery strategies
   * @param {Error} error - The error that occurred
   * @param {string} [groupId] - Optional group call ID
   * @param {string} [phoneId] - Optional phone ID
   */
  handleVGCSError(error, groupId = null, phoneId = null) {
    const errorData = {
      error: error.message,
      errorCode: 'VGCS_ERROR',
      groupId,
      phoneId,
      recoverable: this.isRecoverableError(error),
      timestamp: Date.now()
    };

    if (this.socketBridge) {
      this.socketBridge.processStandardVGCSMessage({
        type: 'VGCS_ERROR',
        data: errorData,
        groupId,
        phoneId,
        recipients: this.getErrorRecipients(groupId, phoneId)
      });
    }

    if (errorData.recoverable && groupId) {
      this.attemptErrorRecovery(groupId, error);
    }
  }

  /**
   * Determine if an error is recoverable
   * @param {Error} error - The error to check
   * @returns {boolean} - Whether the error is recoverable
   */
  isRecoverableError(error) {
    const recoverablePatterns = [
      'network timeout',
      'connection lost',
      'temporary failure',
      'retry available'
    ];

    return recoverablePatterns.some(pattern => 
      error.message.toLowerCase().includes(pattern)
    );
  }

  /**
   * Get list of recipients for error notifications
   * @param {string} groupId - Group call ID
   * @param {string} phoneId - Phone ID
   * @returns {string[]} - List of Discord IDs
   */
  getErrorRecipients(groupId, phoneId) {
    const recipients = [];

    if (groupId && this.activeGroupCalls.has(groupId)) {
      const groupCall = this.activeGroupCalls.get(groupId);
      const participants = groupCall.getAllParticipants();
      recipients.push(...participants.map(phone => phone.getDiscordId()).filter(Boolean));
    }

    if (phoneId) {
      const phone = this.phoneManager.getPhone(phoneId);
      if (phone && phone.getDiscordId()) {
        recipients.push(phone.getDiscordId());
      }
    }

    // Always include admins for error notifications
    // Note: This would need to be configured with actual admin Discord IDs
    // recipients.push(...this.getAdminDiscordIds());

    return [...new Set(recipients)]; // Remove duplicates
  }

  /**
   * Attempt to recover from VGCS errors
   * @param {string} groupId - Group call ID
   * @param {Error} error - The error that occurred
   */
  attemptErrorRecovery(groupId, error) {
    console.log(chalk.yellow('GroupCallManager.attemptErrorRecovery'), `Attempting recovery for group ${groupId}`);

    try {
      const groupCall = this.activeGroupCalls.get(groupId);
      if (!groupCall) {
        console.warn(chalk.yellow('GroupCallManager'), 'Cannot recover - group call not found');
        return;
      }

      // Implement specific recovery strategies based on error type
      if (error.message.includes('network timeout')) {
        this.handleNetworkTimeoutRecovery(groupCall);
      } else if (error.message.includes('connection lost')) {
        this.handleConnectionLostRecovery(groupCall);
      }

    } catch (recoveryError) {
      console.error(chalk.red('GroupCallManager'), 'Error recovery failed:', recoveryError);
      // If recovery fails, terminate the call gracefully
      this.terminateGroupCallDueToError(groupId, error);
    }
  }

  /**
   * Handle network timeout recovery
   * @param {GroupCallRequest} groupCall - The group call to recover
   */
  handleNetworkTimeoutRecovery(groupCall) {
    console.log(chalk.yellow('GroupCallManager'), 'Attempting network timeout recovery');
    
    // Re-establish network connections
    if (groupCall.status === GroupCallRequest.STATUS.ACTIVE) {
      // Try to re-establish the voice channel connection
      // This would involve Discord bot operations
    }
  }

  /**
   * Handle connection lost recovery
   * @param {GroupCallRequest} groupCall - The group call to recover
   */
  handleConnectionLostRecovery(groupCall) {
    console.log(chalk.yellow('GroupCallManager'), 'Attempting connection lost recovery');
    
    // Notify participants of connection issue and attempt reconnection
    const participants = groupCall.getAllParticipants();
    participants.forEach(phone => {
      if (phone.getDiscordId()) {
        this.io.to(phone.getDiscordId()).emit('groupCallConnectionIssue', {
          groupId: groupCall.id,
          message: 'Connection lost, attempting to reconnect...'
        });
      }
    });
  }

  /**
   * Terminate group call due to unrecoverable error
   * @param {string} groupId - Group call ID
   * @param {Error} error - The error that caused termination
   */
  terminateGroupCallDueToError(groupId, error) {
    console.log(chalk.red('GroupCallManager'), `Terminating group call ${groupId} due to error:`, error.message);

    const groupCall = this.activeGroupCalls.get(groupId);
    if (groupCall) {
      // Notify participants of termination
      const participants = groupCall.getAllParticipants();
      participants.forEach(phone => {
        if (phone.getDiscordId()) {
          this.io.to(phone.getDiscordId()).emit('groupCallTerminated', {
            groupId,
            reason: `System error: ${error.message}`,
            unexpected: true
          });
        }
      });

      // Use the proper cleanup method that handles voice channels
      this._cleanupGroupCall(groupId);
    }
  }

  /**
   * Handle socket disconnection cleanup
   * @param {any} socket - Disconnected socket
   */
  async handleSocketDisconnection(socket) {
    if (!socket.discordId) return;

    const userPhones = Array.from(this.phoneToGroupMap.keys()).filter(phoneId => {
      const phone = this.phoneManager.getPhone(phoneId);
      return phone && phone.getDiscordId() === socket.discordId;
    });

    for (const phoneId of userPhones) {
      const groupId = this.phoneToGroupMap.get(phoneId);
      if (groupId) {
        await this.leaveGroupCall(socket.id, phoneId);
      }
    }
  }

  /**
   * Set the CallManager reference for channel termination integration
   * @param {CallManager} callManager 
   */
  setCallManager(callManager) {
    this.callManager = callManager;
  }

  /**
   * Place a REC call using VGCS architecture
   * @param {string} socketId 
   * @param {string} senderPhoneId 
   * @returns {Promise<string|false>} Call ID or false if failed
   */
  async placeRECCall(socketId, senderPhoneId) {
    const senderPhone = this.phoneManager.getPhone(senderPhoneId);
    if (!senderPhone || !senderPhone.getPlayer()) {
      return false;
    }

    const existingMS = this.mobileStations.get(senderPhoneId);
    if (existingMS && existingMS.state === 'ACTIVE' && existingMS.groupId) {
      const existingGroup = this.activeGroupCalls.get(existingMS.groupId);
      if (existingGroup && existingGroup.type === GroupCallRequest.TYPES.REC) {
        return false;
      }
    }

    const recPhones = this.phoneManager.getRECRecipientsForPhone(senderPhone);
    if (recPhones.length === 0) {
      return false;
    }

    const connectedRecipients = recPhones.filter(phone => 
      phone.getPlayer() && phone.getDiscordId()
    );
    
    if (connectedRecipients.length === 0) {
      return false;
    }

    // Create group call request
    const groupId = `REC-${senderPhoneId}-${Date.now()}`;
    const groupCall = new GroupCallRequest(
      senderPhone,
      groupId,
      GroupCallRequest.TYPES.REC,
      GroupCallRequest.LEVELS.EMERGENCY,
      {
        immediateSetup: true,
        autoAnswer: true,
        priority: "emergency"
      }
    );

    const addedDiscordIds = new Set();
    connectedRecipients.forEach(phone => {
      if (phone.getDiscordId() && !addedDiscordIds.has(phone.getDiscordId())) {
        groupCall.addParticipant(phone);
        addedDiscordIds.add(phone.getDiscordId());
      }
    });

    this.activeGroupCalls.set(groupId, groupCall);
    
    this._ensureMobileStation(senderPhoneId, false);
    
    groupCall.participants.forEach(phone => {
      this._ensureMobileStation(phone.getId(), true);
    });

    // Allocate Discord voice channel using enhanced channel management
    const channelResult = await this.requestChannelForGroupCall(groupId);
    if (!channelResult) {
      // Try to terminate a lower priority call to make room for REC
      if (this.callManager) {
        const channelToTerminate = this.callManager.selectChannelToTerminate('REC', 'EMERGENCY');
        if (channelToTerminate) {
          console.log(chalk.yellow('GroupCallManager.placeRECCall'), 
            `Terminating lower priority call on channel: ${channelToTerminate}`);
          
          // Terminate the lower priority call
          await this.bot.terminateCallForChannel(channelToTerminate, null, 'PREEMPTED_BY_REC');
          
          // Try channel allocation again
          const retryChannelResult = await this.requestChannelForGroupCall(groupId);
          if (!retryChannelResult) {
            console.log(chalk.red('GroupCallManager.placeRECCall'), 
              'Still no available channels after terminating lower priority call');
            this.activeGroupCalls.delete(groupId);
            return false;
          }
          
          console.log(chalk.green('GroupCallManager.placeRECCall'), 
            `Successfully allocated channel ${retryChannelResult} after preemption`);
        } else {
          console.log(chalk.red('GroupCallManager.placeRECCall'), 
            'No available channels and no lower priority calls to terminate');
          this.activeGroupCalls.delete(groupId);
          return false;
        }
      } else {
        console.log(chalk.red('GroupCallManager.placeRECCall'), 
          'No available channels and CallManager not set for termination logic');
        this.activeGroupCalls.delete(groupId);
        return false;
      }
    }

    // Start the VGCS call
    const originatorMS = this.mobileStations.get(senderPhoneId);
    const success = originatorMS.startGroupCall(groupId, {
      immediateSetup: true,
      priority: "emergency"
    });

    if (!success) {
      console.log(chalk.red('GroupCallManager.placeRECCall'), 'Failed to start VGCS call');
      this.activeGroupCalls.delete(groupId);
      return false;
    }

    // Track phone to group mapping
    this.phoneToGroupMap.set(senderPhoneId, groupId);
    groupCall.participants.forEach(phone => {
      this.phoneToGroupMap.set(phone.getId(), groupId);
    });

    // Update group call status
    groupCall.updateStatus(GroupCallRequest.STATUS.N1_INITIATED);

    // Send notifications via socket.io
    this._sendGroupCallNotifications(groupCall);
    
    console.log(chalk.green('GroupCallManager.placeRECCall'), `REC call placed successfully: ${groupId}`);
    return groupCall.id;
  }

  /**
   * Accept a REC call using VGCS-based group call management
   * @param {Object} socket - Socket object with discordId
   * @param {Object} callRequest - Legacy CallRequest object for backward compatibility
   * @returns {Promise<boolean>} True if successfully accepted, false otherwise
   */
  async acceptRECCall(socket, callRequest) {
    console.log(chalk.yellow('GroupCallManager.acceptRECCall'), `Processing REC call acceptance for socket: ${socket.id}`);
    
    // Get discordId from socket
    const discordId = socket.discordId;
    
    // Find the phone for this discord ID from the call participants
    let acceptingPhone = null;
    
    // Check if discordId is the sender
    if (callRequest.sender.getDiscordId() === discordId) {
      acceptingPhone = callRequest.sender;
    } else {
      // Check if discordId is among receivers
      const receivers = callRequest.getReceivers();
      acceptingPhone = receivers.find(phone => phone.getDiscordId() === discordId);
    }
    
    if (!acceptingPhone) {
      console.log(chalk.red('GroupCallManager.acceptRECCall'), 'Player not found in REC call participants:', discordId);
      return false;
    }
    
    // Check if player is already on a REC call (prevent multiple REC call participation)
    if (this._isPlayerOnRECCall(discordId)) {
      console.log(chalk.yellow('GroupCallManager.acceptRECCall'), 'Player already on REC call:', discordId);
      return false;
    }
    
    // Find the corresponding group call
    let targetGroupCall = null;
    for (const [groupId, groupCall] of this.activeGroupCalls.entries()) {
      if (groupCall.type === GroupCallRequest.TYPES.REC && 
          groupCall.originator.getId() === callRequest.sender.getId()) {
        targetGroupCall = groupCall;
        break;
      }
    }
    
    if (!targetGroupCall) {
      console.log(chalk.red('GroupCallManager.acceptRECCall'), 'Corresponding group call not found for legacy REC call');
      return false;
    }
    
    // Use VGCS MobileStationVGCS to join the group call
    const phoneId = acceptingPhone.getId();
    const mobileStation = this.vgcsBus.clients.get(phoneId);
    
    if (!mobileStation) {
      console.log(chalk.red('GroupCallManager.acceptRECCall'), 'No mobile station found for phone:', phoneId);
      return false;
    }
    
    // Attempt to accept the group call via VGCS
    try {
      await mobileStation.accept();
      console.log(chalk.green('GroupCallManager.acceptRECCall'), `Mobile station ${phoneId} accepted group call via VGCS`);
    } catch (error) {
      console.log(chalk.red('GroupCallManager.acceptRECCall'), 'Failed to accept group call via VGCS:', error.message);
      return false;
    }
    
    // If no channel assigned yet, allocate one using enhanced channel management
    if (!targetGroupCall.channel) {
      const channelResult = await this.bot.requestCallChannel('REC', targetGroupCall.id, discordId); // Use discordId as originator
      
      if (!channelResult) {
        console.log(chalk.red('GroupCallManager.acceptRECCall'), 'No channel available for REC call acceptance');
        // Revert the VGCS join since channel allocation failed
        mobileStation.leave();
        return false;
      }
      
      targetGroupCall.channel = channelResult;
      console.log(chalk.green('GroupCallManager.acceptRECCall'), `Channel allocated: ${channelResult}`);
    }
    
    // Move player to the call channel
    const moveResult = await this.bot.setUserVoiceChannel(discordId, targetGroupCall.channel);
    
    if (!moveResult) {
      console.log(chalk.red('GroupCallManager.acceptRECCall'), 'Failed to move player to call channel:', discordId);
      // Revert VGCS state on failure
      mobileStation.leave();
      return false;
    }
    
    // Update group call status if this is the first acceptance
    if (targetGroupCall.status === GroupCallRequest.STATUS.N1_INITIATED) {
      targetGroupCall.status = GroupCallRequest.STATUS.N2_ACTIVE;
      console.log(chalk.green('GroupCallManager.acceptRECCall'), 'REC call moved to ACTIVE status');
    }
    
    // Emit success event to the accepting player
    this.io.to(discordId).emit("joinedCall", { "success": true });
    
    // Send call queue updates (delegate to CallManager for compatibility)
    if (this.callManager) {
      this.callManager.sendCallQueueUpdateToPhones(callRequest.getReceivers());
      this.callManager.sendCallQueueUpdateToPhones([callRequest.sender]);
    }
    
    console.log(chalk.green('GroupCallManager.acceptRECCall'), `Player ${discordId} successfully joined REC call: ${targetGroupCall.id}`);
    return true;
  }

  /**
   * Handle a player leaving an ongoing REC call via VGCS
   * @param {string} socketId 
   * @param {CallRequest} call - Legacy CallRequest object
   * @param {string} leaversDiscordId 
   * @returns {Promise<boolean>}
   */
  async leaveRECCall(socketId, call, leaversDiscordId) {
    console.log(chalk.yellow('GroupCallManager.leaveRECCall'), `Processing REC call departure for player: ${leaversDiscordId}`);

    try {
      // Find the phone for this discord ID from the call participants
      let leavingPhone = null;
      
      // Check if discordId is the sender
      if (call.sender.getDiscordId() === leaversDiscordId) {
        leavingPhone = call.sender;
      } else {
        // Check if discordId is among receivers
        const receivers = call.getReceivers();
        leavingPhone = receivers.find(phone => phone.getDiscordId() === leaversDiscordId);
      }

      if (!leavingPhone) {
        console.log(chalk.red('GroupCallManager.leaveRECCall'), 'Player not found in REC call participants:', leaversDiscordId);
        return false;
      }

      // Find the corresponding group call
      let targetGroupCall = null;
      for (const [groupId, groupCall] of this.activeGroupCalls.entries()) {
        if (groupCall.type === GroupCallRequest.TYPES.REC && 
            groupCall.originator.getId() === call.sender.getId()) {
          targetGroupCall = groupCall;
          break;
        }
      }

      if (!targetGroupCall) {
        console.log(chalk.red('GroupCallManager.leaveRECCall'), 'Corresponding group call not found for legacy REC call');
        return false;
      }

      // Use VGCS MobileStationVGCS to leave the group call
      const phoneId = leavingPhone.getId();
      const mobileStation = this.vgcsBus.clients.get(phoneId);

      if (!mobileStation) {
        console.log(chalk.red('GroupCallManager.leaveRECCall'), 'No mobile station found for phone:', phoneId);
        return false;
      }

      // Leave the group call via VGCS
      try {
        await mobileStation.leave();
        console.log(chalk.green('GroupCallManager.leaveRECCall'), `Mobile station ${phoneId} left group call via VGCS`);
      } catch (error) {
        console.log(chalk.red('GroupCallManager.leaveRECCall'), 'Failed to leave group call via VGCS:', error.message);
        return false;
      }

      // ENHANCED VOICE CHANNEL MANAGEMENT:
      // Check if this will be the last person leaving to determine the approach
      const allParticipants = [call.sender, ...call.getReceivers()];
      const remainingParticipants = allParticipants.filter(phone => 
        phone.getDiscordId() !== leaversDiscordId && phone.getDiscordId() !== null
      );

      console.log(chalk.yellow('GroupCallManager.leaveRECCall'), 'Remaining participants:', remainingParticipants.length);

      // If this is NOT the last person, move them back individually (call continues)
      if (remainingParticipants.length > 0) {
        await this.bot.setUserVoiceChannel(leaversDiscordId);
        console.log(chalk.green('GroupCallManager.leaveRECCall'), `Moved leaving participant ${leaversDiscordId} back to original channel`);
      }

      // If this was the last person, terminate the call
      if (remainingParticipants.length === 0) {
        console.log(chalk.yellow('GroupCallManager.leaveRECCall'), 'Last person left, terminating REC call:', call.id);
        
        // Update legacy call status
        call.status = CallRequest.STATUS.ENDED;
        
        // Remove from CallManager's ongoing calls (delegate back to CallManager)
        if (this.callManager) {
          this.callManager.ongoingCalls = this.callManager.ongoingCalls.filter(c => c.id !== call.id);
          this.callManager.pastCalls.push(call);
        }

        // Clean up VGCS group call
        this._cleanupGroupCall(targetGroupCall.id);

        // Release the channel through bot (enhanced channel management)
        // terminateCallForChannel will move ALL users (including the leaver) back to their original channels
        if (targetGroupCall.channel) {
          await this.bot.terminateCallForChannel(targetGroupCall.channel, leaversDiscordId, 'COMPLETED');
        }
      }

      // Update call queues for all phones (delegate to CallManager for compatibility)
      if (this.callManager) {
        this.callManager.sendCallQueueUpdateToPhones(call.getReceivers());
        this.callManager.sendCallQueueUpdateToPhones([call.sender]);
      }

      console.log(chalk.green('GroupCallManager.leaveRECCall'), `Player ${leaversDiscordId} successfully left REC call: ${targetGroupCall.id}`);
      return true;

    } catch (error) {
      console.error(chalk.red('GroupCallManager.leaveRECCall'), 'Error processing REC call departure:', error.message);
      return false;
    }
  }
  
  /**
   * Check if a player is currently on any REC call via VGCS
   * @param {string} discordId 
   * @returns {boolean}
   */
  _isPlayerOnRECCall(discordId) {
    // Check all active REC group calls for this player
    for (const [groupId, groupCall] of this.activeGroupCalls.entries()) {
      if (groupCall.type === GroupCallRequest.TYPES.REC) {
        // Check if player is among participants
        const participants = groupCall.getAllParticipants();
        if (participants.some(participant => participant.getDiscordId() === discordId)) {
          return true;
        }
      }
    }
    return false;
  }

  /**
   * Join a group call
   * @param {string} socketId 
   * @param {string} phoneId 
   * @param {string} groupId 
   * @returns {boolean}
   */
  joinGroupCall(socketId, phoneId, groupId) {
    console.log(chalk.yellow('GroupCallManager.joinGroupCall'), `Socket: ${socketId}, Phone: ${phoneId}, Group: ${groupId}`);
    
    const groupCall = this.activeGroupCalls.get(groupId);
    if (!groupCall) {
      console.log(chalk.red('GroupCallManager.joinGroupCall'), 'Group call not found');
      return false;
    }

    const phone = this.phoneManager.getPhone(phoneId);
    if (!phone) {
      console.log(chalk.red('GroupCallManager.joinGroupCall'), 'Phone not found');
      return false;
    }

    // Ensure mobile station exists
    this._ensureMobileStation(phoneId, groupCall.type === GroupCallRequest.TYPES.REC);
    
    const mobileStation = this.mobileStations.get(phoneId);
    const success = mobileStation.accept();
    
    if (success) {
      this.phoneToGroupMap.set(phoneId, groupId);
      console.log(chalk.green('GroupCallManager.joinGroupCall'), 'Successfully joined group call');
    }
    
    return success;
  }

  /**
   * Leave a group call
   * @param {string} socketId 
   * @param {string} phoneId 
   * @returns {Promise<boolean>}
   */
  async leaveGroupCall(socketId, phoneId) {
    const groupId = this.phoneToGroupMap.get(phoneId);
    if (!groupId) {
      return false;
    }

    const mobileStation = this.mobileStations.get(phoneId);
    if (!mobileStation) {
      console.log(chalk.red('GroupCallManager.leaveGroupCall'), 'Mobile station not found');
      return false;
    }

    const groupCall = this.activeGroupCalls.get(groupId);
    if (!groupCall) {
      console.log(chalk.red('GroupCallManager.leaveGroupCall'), 'Group call not found');
      return false;
    }

    // Add debug logging before attempting to leave
    console.log(chalk.cyan('GroupCallManager.leaveGroupCall DEBUG'), 
      `MS State: ${mobileStation.state}, isOriginator: ${mobileStation.isOriginator}, GroupId: ${mobileStation.groupId}`);

    // BUGFIX: Handle the case where participant tries to leave before reaching ACTIVE state
    // This can happen due to timing issues with CHANNEL_ASSIGN messages
    if (mobileStation.state !== 'ACTIVE' && !mobileStation.isOriginator) {
      console.log(chalk.yellow('GroupCallManager.leaveGroupCall'), 
        `Participant in ${mobileStation.state} state attempting to leave - allowing immediate departure`);
      
      // For participants not yet ACTIVE, we can safely clean up without going through VGCS protocol
      this.phoneToGroupMap.delete(phoneId);
      mobileStation._reset(false); // Reset the mobile station
      
      // Voice channel restoration for non-active participants
      try {
        const phone = this.phoneManager.getPhone(phoneId);
        const player = phone?.getPlayer();
        if (player && player.discordId) {
          console.log(chalk.cyan('GroupCallManager.leaveGroupCall'), 
            `Restoring voice channel for non-active participant ${player.discordId}`);
          await this.bot.setUserVoiceChannel(player.discordId);
        }
      } catch (error) {
        console.error(chalk.red('GroupCallManager.leaveGroupCall'), 
          'Failed to restore voice channel for non-active participant:', error);
      }
      
      console.log(chalk.green('GroupCallManager.leaveGroupCall'), 'Non-active participant departure completed');
      return true;
    }

    // BUGFIX: Handle REC call originator drop-out
    // In REC calls, the originator should be able to drop out while allowing the call to continue
    if (mobileStation.isOriginator && groupCall.type === GroupCallRequest.TYPES.REC) {
      console.log(chalk.yellow('GroupCallManager.leaveGroupCall'), 
        'REC call originator dropping out - transferring call ownership');
      
      // Get the originator's Discord ID for voice channel management
      const originatorPhone = this.phoneManager.getPhone(phoneId);
      const originatorDiscordId = originatorPhone ? originatorPhone.getDiscordId() : null;
      
      // Find another active participant to transfer ownership to
      const otherParticipants = [];
      for (const [participantPhoneId, participantGroupId] of this.phoneToGroupMap.entries()) {
        if (participantGroupId === groupId && participantPhoneId !== phoneId) {
          const participantMS = this.mobileStations.get(participantPhoneId);
          if (participantMS && participantMS.state === 'ACTIVE') {
            otherParticipants.push(participantPhoneId);
          }
        }
      }

      if (otherParticipants.length > 0) {
        // Transfer ownership to the first active participant
        const newOriginatorPhoneId = otherParticipants[0];
        const newOriginatorMS = this.mobileStations.get(newOriginatorPhoneId);
        
        if (newOriginatorMS) {
          newOriginatorMS.isOriginator = true;
          console.log(chalk.green('GroupCallManager.leaveGroupCall'), 
            `Transferred REC call ownership to: ${newOriginatorPhoneId}`);
        }
        
        // Update group call originator
        const newOriginatorPhone = this.phoneManager.getPhone(newOriginatorPhoneId);
        if (newOriginatorPhone) {
          groupCall.originator = newOriginatorPhone;
        }
        
        // Remove the original originator from the call
        mobileStation.isOriginator = false; // Temporarily remove originator status
        const success = mobileStation.leave(); // Now this should work
        
        if (success) {
          this.phoneToGroupMap.delete(phoneId);
          
          // BUGFIX: Move the dropping originator back to their original Discord voice channel
          if (originatorDiscordId && this.bot) {
            try {
              await this.bot.setUserVoiceChannel(originatorDiscordId);
              console.log(chalk.green('GroupCallManager.leaveGroupCall'), 
                `Moved dropping originator ${originatorDiscordId} back to original voice channel`);
            } catch (error) {
              console.error(chalk.red('GroupCallManager.leaveGroupCall'), 
                'Failed to move dropping originator back to original channel:', error.message);
            }
          }
          
          console.log(chalk.green('GroupCallManager.leaveGroupCall'), 
            'Original REC originator successfully dropped out, call continues');
        }
        
        return success;
      } else {
        // No other participants - terminate the call
        console.log(chalk.yellow('GroupCallManager.leaveGroupCall'), 
          'REC originator leaving with no other participants - terminating call');
        return this.terminateGroupCall(socketId, phoneId);
      }
    }

    const success = mobileStation.leave();
    
    // Add debug logging after leave attempt
    console.log(chalk.cyan('GroupCallManager.leaveGroupCall DEBUG'), 
      `Leave result: ${success}, MS State after: ${mobileStation.state}`);
    
    if (success) {
      this.phoneToGroupMap.delete(phoneId);
      
      // BUGFIX: Move the participant back to their original Discord voice channel
      const phone = this.phoneManager.getPhone(phoneId);
      const discordId = phone ? phone.getDiscordId() : null;
      
      if (discordId && this.bot) {
        try {
          await this.bot.setUserVoiceChannel(discordId);
          console.log(chalk.green('GroupCallManager.leaveGroupCall'), 
            `Moved participant ${discordId} back to original voice channel`);
        } catch (error) {
          console.error(chalk.red('GroupCallManager.leaveGroupCall'), 
            'Failed to move participant back to original channel:', error.message);
        }
      }
      
      console.log(chalk.green('GroupCallManager.leaveGroupCall'), 'Successfully left group call');
    }
    
    return success;
  }

  /**
   * Terminate a group call (originator or admin)
   * @param {string} socketId 
   * @param {string} phoneId 
   * @returns {boolean}
   */
  terminateGroupCall(socketId, phoneId) {
    console.log(chalk.yellow('GroupCallManager.terminateGroupCall'), `Socket: ${socketId}, Phone: ${phoneId}`);
    
    const groupId = this.phoneToGroupMap.get(phoneId);
    if (!groupId) {
      console.log(chalk.red('GroupCallManager.terminateGroupCall'), 'Phone not in any group call');
      return false;
    }

    const groupCall = this.activeGroupCalls.get(groupId);
    if (!groupCall) {
      console.log(chalk.red('GroupCallManager.terminateGroupCall'), 'Group call not found');
      return false;
    }

    // Check if phone is the originator
    const phone = this.phoneManager.getPhone(phoneId);
    if (!phone || !groupCall.isOriginator(phone)) {
      console.log(chalk.red('GroupCallManager.terminateGroupCall'), 'Not authorized to terminate call');
      return false;
    }

    const mobileStation = this.mobileStations.get(phoneId);
    if (!mobileStation) {
      console.log(chalk.red('GroupCallManager.terminateGroupCall'), 'Mobile station not found');
      return false;
    }

    const success = mobileStation.terminate();
    if (success) {
      console.log(chalk.green('GroupCallManager.terminateGroupCall'), 'Group call terminated');
      this._cleanupGroupCall(groupId);
    }
    
    return success;
  }

  /**
   * Get active group calls for a phone
   * @param {string} phoneId 
   * @returns {GroupCallRequest[]}
   */
  getActiveGroupCallsForPhone(phoneId) {
    const calls = [];
    const groupId = this.phoneToGroupMap.get(phoneId);
    
    if (groupId) {
      const groupCall = this.activeGroupCalls.get(groupId);
      if (groupCall) {
        calls.push(groupCall);
      }
    }
    
    return calls;
  }

  /**
   * Get all active group calls
   * @returns {GroupCallRequest[]}
   */
  getAllActiveGroupCalls() {
    return Array.from(this.activeGroupCalls.values());
  }

  /**
   * Request a voice channel for a group call using enhanced channel management
   * @param {string} groupId 
   * @returns {Promise<string|null>} Channel ID or null if none available
   */
  async requestChannelForGroupCall(groupId) {
    console.log(chalk.yellow('GroupCallManager.requestChannelForGroupCall'), `GroupId: ${groupId}`);
    
    const groupCall = this.activeGroupCalls.get(groupId);
    if (!groupCall) {
      console.warn(chalk.yellow('GroupCallManager.requestChannelForGroupCall'), 
        'Group call not found:', groupId);
      return null;
    }

    // Determine call type and collect participant info
    const callType = groupCall.type === GroupCallRequest.TYPES.REC ? 'REC' : 'GROUP';
    const originatorDiscordId = groupCall.originator.getDiscordId();
    const participantDiscordIds = Array.from(groupCall.participants)
      .map(phone => phone.getDiscordId())
      .filter(id => id !== null);

    // Use enhanced channel allocation from Phase 2
    const channelResult = await this.bot.requestCallChannel(
      callType,
      groupId,
      originatorDiscordId,
      participantDiscordIds,
      {
        immediateSetup: groupCall.options.immediateSetup,
        autoAnswer: groupCall.options.autoAnswer,
        priority: groupCall.options.priority
      }
    );

    if (!channelResult) {
      console.warn(chalk.yellow('GroupCallManager.requestChannelForGroupCall'), 
        'No available channels for group call:', groupId);
      return null;
    }
    
    // Update group call with channel info
    groupCall.channel = channelResult.channelId;
    groupCall.channelPriority = channelResult.priority;
    
    console.log(chalk.green('GroupCallManager.requestChannelForGroupCall'), 
      'Allocated channel for group call:', groupId, channelResult);
    
    return channelResult.channelId;
  }

  // --- Internal methods ---

  /**
   * Ensure a mobile station exists for a phone
   * @param {string} phoneId 
   * @param {boolean} autoAnswer 
   */
  _ensureMobileStation(phoneId, autoAnswer) {
    if (!this.mobileStations.has(phoneId)) {
      console.log(chalk.cyan('GroupCallManager._ensureMobileStation'), `Creating MS for phone: ${phoneId}`);
      
      const mobileStation = new MobileStationVGCS({
        msId: phoneId,
        bus: this.vgcsBus,
        autoAnswer: autoAnswer
      });
      
      this.mobileStations.set(phoneId, mobileStation);
    }
  }

  /**
   * Send group call notifications via socket.io
   * @param {GroupCallRequest} groupCall 
   */
  _sendGroupCallNotifications(groupCall) {
    if (groupCall.type === GroupCallRequest.TYPES.REC) {
      // For REC calls, send REC notifications through VGCS Socket Bridge
      console.log(chalk.blue('GroupCallManager._sendGroupCallNotifications'), 
        'Sending REC notifications via VGCS Socket Bridge');
      
      // Get recipients from the original REC recipients calculation
      const senderPhone = groupCall.originator;
      const recPhones = this.phoneManager.getRECRecipientsForPhone(senderPhone);
      
      // Debug logging for recipient phone details
      console.log(chalk.magenta('GroupCallManager._sendGroupCallNotifications'), 
        'Debug REC recipients:');
      recPhones.forEach((phone, index) => {
        console.log(chalk.magenta('  Recipient'), index, ':', {
          id: phone.getId(),
          hasDiscordId: !!phone.getDiscordId(),
          discordId: phone.getDiscordId(),
          hasPlayer: !!phone.getPlayer(),
          player: phone.getPlayer() ? phone.getPlayer().displayName : 'None'
        });
      });
      
      // Include both recipients AND the originator in notifications
      const allNotificationTargets = [...recPhones];
      
      // Add originator to notification list (they should see REC controls too)
      if (senderPhone.getDiscordId() && !allNotificationTargets.some(phone => phone.getId() === senderPhone.getId())) {
        allNotificationTargets.push(senderPhone);
        console.log(chalk.cyan('GroupCallManager._sendGroupCallNotifications'), 
          'Added originator to REC notification list:', senderPhone.getId());
      }
      
      const recipients = allNotificationTargets
        .filter(phone => phone.getDiscordId())
        .map(phone => phone.getDiscordId());
      
      console.log(chalk.cyan('GroupCallManager._sendGroupCallNotifications'), 
        `REC call recipients (including originator): ${recipients.length} Discord IDs: [${recipients.join(', ')}]`);
      
      const notificationData = {
        groupId: groupCall.id,
        originatorName: groupCall.originator.getName(),
        level: groupCall.level,
        autoJoinCountdown: 5,
        adminUsers: [],
        timestamp: Date.now()
      };
      
      // Emit REC notification through socket bridge
      this.socketBridge.processStandardVGCSMessage({
        type: 'REC_NOTIFICATION',
        data: notificationData,
        groupId: groupCall.id,
        phoneId: groupCall.originator.getId(),
        recipients: recipients
      });
      
      console.log(chalk.green('GroupCallManager._sendGroupCallNotifications'), 
        `Sent REC notifications to ${recipients.length} recipients (including originator)`);
    } else {
      // For other group calls, use standard notification
      const allPhones = groupCall.getAllParticipants();
      
      allPhones.forEach(phone => {
        if (phone.getDiscordId()) {
          this.io.to(phone.getDiscordId()).emit('newGroupCall', groupCall.toEmittable());
        }
      });
      
      console.log(chalk.green('GroupCallManager._sendGroupCallNotifications'), 
        `Sent notifications to ${allPhones.length} phones`);
    }
  }

  /**
   * Clean up a completed group call
   * @param {string} groupId 
   */
  _cleanupGroupCall(groupId) {
    console.log(chalk.cyan('GroupCallManager._cleanupGroupCall'), `GroupId: ${groupId}`);
    
    const groupCall = this.activeGroupCalls.get(groupId);
    if (groupCall) {
      // Remove phone mappings
      groupCall.getAllParticipants().forEach(phone => {
        this.phoneToGroupMap.delete(phone.getId());
      });
      
      // Terminate call and move players back to original channels
      if (groupCall.channel) {
        const originatorPhone = groupCall.originator;
        const originatorDiscordId = originatorPhone ? originatorPhone.getDiscordId() : null;
        
        console.log(chalk.green('GroupCallManager._cleanupGroupCall'), 
          `Terminating call channel ${groupCall.channel} for group ${groupId}`);
        
        // Use proper termination method that moves players back to original channels
        this.bot.terminateCallForChannel(groupCall.channel, originatorDiscordId, 'COMPLETED')
          .then(success => {
            if (success) {
              console.log(chalk.green('GroupCallManager._cleanupGroupCall'), 
                'Channel terminated and players moved back to original channels');
            } else {
              console.warn(chalk.yellow('GroupCallManager._cleanupGroupCall'), 
                'Failed to terminate channel properly');
            }
          })
          .catch(error => {
            console.error(chalk.red('GroupCallManager._cleanupGroupCall'), 
              'Error terminating channel:', error);
          });
      }
      
      // Remove from active calls
      this.activeGroupCalls.delete(groupId);
      
      console.log(chalk.green('GroupCallManager._cleanupGroupCall'), 'Group call cleaned up');
    }
  }

  /**
   * Debug function to check mobile station states
   * @param {string} phoneId 
   * @returns {Object}
   */
  getMobileStationDebugInfo(phoneId) {
    const mobileStation = this.mobileStations.get(phoneId);
    if (!mobileStation) {
      return { error: 'Mobile station not found' };
    }

    return {
      phoneId: phoneId,
      state: mobileStation.state,
      isOriginator: mobileStation.isOriginator,
      groupId: mobileStation.groupId,
      autoAnswer: mobileStation.autoAnswer,
      mappedGroupId: this.phoneToGroupMap.get(phoneId),
      canLeave: mobileStation.state === 'ACTIVE' && !mobileStation.isOriginator
    };
  }

  /**
   * Debug function to check all mobile station states
   * @returns {Object}
   */
  getAllMobileStationDebugInfo() {
    const info = {};
    for (const [phoneId, mobileStation] of this.mobileStations) {
      info[phoneId] = {
        state: mobileStation.state,
        isOriginator: mobileStation.isOriginator,
        groupId: mobileStation.groupId,
        autoAnswer: mobileStation.autoAnswer,
        mappedGroupId: this.phoneToGroupMap.get(phoneId),
        canLeave: mobileStation.state === 'ACTIVE' && !mobileStation.isOriginator
      };
    }
    return info;
  }
}
