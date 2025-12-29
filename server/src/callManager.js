//@ts-check
import chalk from 'chalk';
import CallRequest from './model/callrequest.js';
/** @typedef {import("./model/phone.js").default} Phone */
/** @typedef {import("./bot.js").default} DiscordBot */
/** @typedef {import("./phonemanager.js").default} PhoneManager */
/** @typedef {import("socket.io").Server} Server */
/** @typedef {import("socket.io").Socket} Socket */

export default class CallManager {

  /** @type {CallRequest[]} */
  requestedCalls = [];
  /** @type {CallRequest[]} */
  ongoingCalls = [];
  /** @type {CallRequest[]} */
  pastCalls = [];

  static CALL_PRIORITIES = {
    [CallRequest.TYPES.REC]: 1,
    [CallRequest.TYPES.P2P + '_' + CallRequest.LEVELS.EMERGENCY]: 2,
    [CallRequest.TYPES.P2P + '_' + CallRequest.LEVELS.URGENT]: 3,  
    [CallRequest.TYPES.P2P + '_' + CallRequest.LEVELS.NORMAL]: 4
  };


  /**
   * @param {PhoneManager} phoneManager 
   * @param {DiscordBot} bot 
   * @param {Server} io 
   * @param {import("./groupCallManager.js").default} groupCallManager
   */
  constructor(phoneManager, bot, io, groupCallManager = null) {
    this.phoneManager = phoneManager;
    this.bot = bot;
    this.io = io;
    
    /** @type {import("./groupCallManager.js").default|null} */
    this.groupCallManager = groupCallManager;
  }

  /**
   * Set the GroupCallManager reference for REC call delegation
   * @param {import("./groupCallManager.js").default} groupCallManager 
   */
  setGroupCallManager(groupCallManager) {
    this.groupCallManager = groupCallManager;
  }

  /**
   * Get all active private calls (P2P and GROUP) for admin interface
   * @returns {Object} Object with call IDs as keys and call data as values
   */
  getAllPrivateCalls() {
    const activeCalls = {};
    
    this.requestedCalls.forEach(call => {
      if (call.type === CallRequest.TYPES.P2P || call.type === CallRequest.TYPES.GROUP) {
        activeCalls[call.id] = call.toEmittable();
      }
    });
    
    this.ongoingCalls.forEach(call => {
      if (call.type === CallRequest.TYPES.P2P || call.type === CallRequest.TYPES.GROUP) {
        activeCalls[call.id] = call.toEmittable();
      }
    });
    
    return activeCalls;
  }


  /**
   * @param {Phone} phone 
   * @returns {CallRequest[]}
   */
  getCallQueueForPhone(phone) {
    const requestedCalls = this.requestedCalls.filter((c) => (c.isForPhone(phone) || c.isFromPhone(phone)));
    const ongoingCalls = this.ongoingCalls.filter((c) => (c.isForPhone(phone) || c.isFromPhone(phone)));
    const pastCalls = this.pastCalls.filter((c) => (c.isForPhone(phone) || c.isFromPhone(phone)));
    
    const toNowCalls = requestedCalls.concat(ongoingCalls);
    const last10PastCalls = pastCalls.slice(-10);
    toNowCalls.push(...last10PastCalls);

    return toNowCalls;
  }

  /**
   * Get the priority value for a call type and level
   * @param {string} callType - 'REC' or 'P2P'
   * @param {string} callLevel - 'EMERGENCY', 'URGENT', or 'NORMAL'
   * @returns {number} Priority value (lower = higher priority)
   */
  getCallPriority(callType, callLevel) {
    if (callType === 'REC') {
      return CallManager.CALL_PRIORITIES.REC;
    }
    
    if (callType === 'P2P') {
      switch (callLevel) {
        case 'EMERGENCY':
          return CallManager.CALL_PRIORITIES.P2P_EMERGENCY;
        case 'URGENT':
          return CallManager.CALL_PRIORITIES.P2P_URGENT;
        case 'NORMAL':
          return CallManager.CALL_PRIORITIES.P2P_NORMAL;
        default:
          return CallManager.CALL_PRIORITIES.P2P_NORMAL;
      }
    }
    
    // Default to lowest priority
    return CallManager.CALL_PRIORITIES.P2P_NORMAL;
  }

  /**
   * Compare two calls to determine which has higher priority
   * @param {object} call1 - First call with type and level
   * @param {object} call2 - Second call with type and level
   * @returns {number} -1 if call1 has higher priority, 1 if call2 has higher priority, 0 if equal
   */
  compareCallPriorities(call1, call2) {
    const priority1 = this.getCallPriority(call1.type, call1.level);
    const priority2 = this.getCallPriority(call2.type, call2.level);
    
    if (priority1 < priority2) return -1;
    if (priority1 > priority2) return 1;
    return 0;
  }

  /**
   * Select the lowest priority channel to terminate when higher priority call needs access
   * @param {string} requiredCallType - Type of call needing channel ('REC' or 'P2P')
   * @param {string} requiredCallLevel - Level of call needing channel ('EMERGENCY', 'URGENT', 'NORMAL')
   * @returns {string|null} Channel ID to terminate, or null if no suitable channel found
   */
  selectChannelToTerminate(requiredCallType, requiredCallLevel) {
    try {
      // Get all active channels from bot
      const channelStats = this.bot.getChannelUsageInfo();
      if (!channelStats.channels) {
        return null;
      }

      // Filter for channels that are currently in use
      const activeChannels = channelStats.channels.filter(channel => channel.status === 'IN_USE');
      if (activeChannels.length === 0) {
        return null;
      }

      // Calculate required call priority
      const requiredPriority = this.getCallPriority(requiredCallType, requiredCallLevel);

      // Find channels with lower priority (higher priority number)
      const preemptibleChannels = activeChannels.filter(channel => {
        // If channel has no call type, treat as lowest priority P2P NORMAL
        const channelCallType = channel.callType || 'P2P';
        const channelCallLevel = 'NORMAL'; // Default level for existing calls without explicit level
        const channelPriority = this.getCallPriority(channelCallType, channelCallLevel);
        
        return channelPriority > requiredPriority;
      });

      if (preemptibleChannels.length === 0) {
        return null;
      }

      // Sort by priority (highest priority number = lowest priority = most preemptible)
      // Then by participant count (fewer participants = easier to preempt)
      // Then by duration (longer calls = more established, less likely to preempt)
      preemptibleChannels.sort((a, b) => {
        // First sort by call type priority (higher priority number = lower priority)
        const priorityA = this.getCallPriority(a.callType || 'P2P', 'NORMAL');
        const priorityB = this.getCallPriority(b.callType || 'P2P', 'NORMAL');
        
        if (priorityA !== priorityB) {
          return priorityB - priorityA; // Descending order - higher priority number first
        }

        // Then sort by participant count (fewer participants first)
        if (a.participantCount !== b.participantCount) {
          return a.participantCount - b.participantCount; // Ascending order
        }

        // Finally sort by duration (shorter calls first)
        const durationA = a.duration || 0;
        const durationB = b.duration || 0;
        return durationA - durationB; // Ascending order
      });

      // Return the most suitable channel to terminate
      return preemptibleChannels[0].channelId;

    } catch (error) {
      console.error(chalk.red('selectChannelToTerminate'), 'Error selecting channel to terminate:', error);
      return null;
    }
  }

  /**
   * Force disconnect players from lower priority calls to join a higher priority call
   * @param {string[]} discordIds - Discord IDs of players to check and potentially disconnect
   * @param {string} requiredCallType - Type of call needing participants ('REC' or 'P2P')
   * @param {string} requiredCallLevel - Level of call needing participants ('EMERGENCY', 'URGENT', 'NORMAL')
   * @returns {Promise<string[]>} Array of Discord IDs that were successfully disconnected
   */
  async forceDisconnectFromLowerPriorityCall(discordIds, requiredCallType, requiredCallLevel) {
    const disconnectedPlayers = [];
    const requiredPriority = this.getCallPriority(requiredCallType, requiredCallLevel);
    
    try {
      for (const discordId of discordIds) {
        // Find current call for this player
        const currentCall = this.findActiveCallForPlayer(discordId);
        if (!currentCall) {
          continue; // Player not in any call
        }

        // Determine current call priority (assume P2P NORMAL if type/level not set)
        const currentCallType = currentCall.type || 'P2P';
        const currentCallLevel = currentCall.level || 'NORMAL';
        const currentPriority = this.getCallPriority(currentCallType, currentCallLevel);

        // Only disconnect if current call has lower priority (higher priority number)
        if (currentPriority > requiredPriority) {
          console.log(chalk.yellow('forceDisconnectFromLowerPriorityCall'), 
            `Disconnecting ${discordId} from ${currentCallType}:${currentCallLevel} (priority ${currentPriority}) for ${requiredCallType}:${requiredCallLevel} (priority ${requiredPriority})`);
          
          // Remove player from current call
          if (currentCall.type === 'REC') {
            await this.leaveRECCall(null, currentCall, discordId);
          } else {
            // For P2P calls, remove from ongoing calls and disconnect from voice
            this.ongoingCalls = this.ongoingCalls.filter(call => call.id !== currentCall.id);
            
            // Move player back to default channel
            await this.bot.setUserVoiceChannel(discordId);
            
            // Update call queues for affected phones
            const allParticipants = [currentCall.sender, ...currentCall.getReceivers()];
            this.sendCallQueueUpdateToPhones(allParticipants);
          }
          
          disconnectedPlayers.push(discordId);
          
          console.log(chalk.green('forceDisconnectFromLowerPriorityCall'), 
            `Successfully disconnected ${discordId} from lower priority call`);
        } else {
          console.log(chalk.blue('forceDisconnectFromLowerPriorityCall'), 
            `Player ${discordId} in equal/higher priority call (${currentCallType}:${currentCallLevel}), not disconnecting`);
        }
      }
      
      return disconnectedPlayers;
      
    } catch (error) {
      console.error(chalk.red('forceDisconnectFromLowerPriorityCall'), 'Error during force disconnect:', error);
      return disconnectedPlayers; // Return partial results
    }
  }

  /**
   * Find the active call for a player by Discord ID
   * @param {string} discordId 
   * @returns {CallRequest|null}
   */
  findActiveCallForPlayer(discordId) {
    // Check ongoing calls
    for (const call of this.ongoingCalls) {
      if (call.sender.getDiscordId() === discordId || 
          call.getReceivers().some(phone => phone.getDiscordId() === discordId)) {
        return call;
      }
    }
    
    // Check requested calls (calls that are offered but not yet accepted)
    for (const call of this.requestedCalls) {
      if (call.sender.getDiscordId() === discordId || 
          call.getReceivers().some(phone => phone.getDiscordId() === discordId)) {
        return call;
      }
    }
    
    return null;
  }


  /**
   * 
   * @param {string} socketId 
   * @param {string} callType 
   * @param {string} callLevel
   * @param {string} senderPhoneId 
   * @param {object[]|null} receiverPhones 
   * @returns {Promise<string|boolean>}
   */
  async placeCall(socketId, callType, callLevel, senderPhoneId, receiverPhones = null) {
    if (typeof this.phoneManager.getPhone(senderPhoneId) === 'undefined') {
      console.warn(chalk.yellow('placeCall'), chalk.red("Sender phone not valid: "), senderPhoneId);
      return false;
    }

    if (this.phoneManager.getPhone(senderPhoneId).getDiscordId() === null) {
      console.warn(chalk.yellow('placeCall'), chalk.red("Sender phone not assigned to a player: "), senderPhoneId);
      return false;
    }

    const sendingPhone = this.phoneManager.getPhone(senderPhoneId);

    const sendingPlayerId = sendingPhone.getDiscordId();

    let callRequest;

    if (callType === CallRequest.TYPES.P2P) {
      let receiverPhoneId
      if(typeof receiverPhones === "object") {
        receiverPhoneId = receiverPhones[0].id;
      } else {
        receiverPhoneId = receiverPhones;
      }

      if (typeof this.phoneManager.getPhone(receiverPhoneId) === 'undefined') {
        console.warn(chalk.yellow('placeCall'), chalk.red("Receiver phone not valid: "), receiverPhoneId, senderPhoneId);
        return false;
      }

      if (this.phoneManager.getPhone(receiverPhoneId).getDiscordId() === null) {
        console.warn(chalk.yellow('placeCall'), chalk.red("Receiver phone not assigned to a player: "), receiverPhoneId, senderPhoneId);
        return false;
      }
      const receivingPhone = this.phoneManager.getPhone(receiverPhoneId);
      const receivingPlayerId = receivingPhone.getDiscordId();

      if (sendingPlayerId !== receivingPlayerId) {
        callRequest = new CallRequest(sendingPhone, receivingPhone, callType, callLevel);
      } else {
        return false
      }
    } else if (callType === CallRequest.TYPES.REC) {
      if (this.groupCallManager) {
        if (callLevel !== CallRequest.LEVELS.EMERGENCY) {
          return false;
        }
        
        const recCallId = await this.groupCallManager.placeRECCall(socketId, senderPhoneId);
        if (!recCallId) {
          return false;
        }
        
        return recCallId;
      } else {
        console.warn(chalk.yellow('placeCall'), 'GroupCallManager not available, using legacy REC handling');
        
        if (callLevel !== CallRequest.LEVELS.EMERGENCY) {
          return false;
        }
        
        try {
          const recPhones = this.phoneManager.getRECRecipientsForPhone(sendingPhone);
          if (recPhones && recPhones.length > 0) {
            callRequest = new CallRequest(sendingPhone, recPhones, CallRequest.TYPES.REC, CallRequest.LEVELS.EMERGENCY);
          } else {
            return false;
          }
        } catch (error) {
          return false;
        }
      }
    } else {
      return false;
    }

    this.requestedCalls.push(callRequest);
    this.sendNewCallNotifications(callRequest);
    this.sendCallQueueUpdateToPhones(callRequest.getReceivers());
    this.sendCallQueueUpdateToPhones([callRequest.sender]);

    return callRequest.id;

  }

  requestPhoneQueueUpdate(phoneId) {
    const phone = this.phoneManager.getPhone(phoneId);
    if (typeof phone === 'undefined') {
      console.warn(chalk.yellow('requestPhoneQueueUpdate'), 'Phone not found', phoneId);
      return false;
    }
    this.sendCallQueueUpdateToPhones([phone]);
  }


  /**
   * 
   * @param {Phone[]} receivers 
   */
  sendCallQueueUpdateToPhones(receivers) {
    receivers.forEach((phone) => {
      const queue = this.getCallQueueForPhone(phone);
      const emittableQueue = queue.map((r) => r.toEmittable());
      this.io.to(phone.getDiscordId()).emit('callQueueUpdate', { 'phoneId': phone.getId(), 'queue': emittableQueue });
    });
  }

  /**
   * Send new call notifications to phones
   * @param {CallRequest} callRequest 
   */
  sendNewCallNotifications(callRequest) {
    const allPhones = [callRequest.sender, ...callRequest.getReceivers()];
    
    allPhones.forEach((phone) => {
      if (phone.getDiscordId()) {
        this.io.to(phone.getDiscordId()).emit('callUpdate', callRequest.toEmittable());
      }
    });
  }

  /**
   * 
   * @param {Socket} socket 
   * @param {string} callId 
   * @returns 
   */
  async acceptCall(socket, callId) {
    const callRequest = this.requestedCalls.find(x => x.id === callId) || this.ongoingCalls.find(x => x.id === callId);

    if (typeof callRequest === 'undefined') {
      console.log(chalk.yellow('acceptCall'), socket.id, 'attempting to accept undefined call', callId);
      
      // Additional debugging: check if call exists in pastCalls
      const pastCall = this.pastCalls.find(x => x.id === callId);
      if (pastCall) {
        console.log(chalk.yellow('acceptCall'), 'Call found in pastCalls with status:', pastCall.status);
      }
      
      // Force a call queue update to clean up client state
      // @ts-expect-error
      const phones = this.phoneManager.getPhonesForDiscordId(socket.discordId);
      if (phones && phones.length > 0) {
        console.log(chalk.yellow('acceptCall'), 'Sending queue update to clean up stale call for phones:', phones.map(p => p.getId()));
        this.sendCallQueueUpdateToPhones(phones);
      }
      
      return false;
    }

    // Handle REC call acceptance
    if (callRequest.type === CallRequest.TYPES.REC) {
      return await this.acceptRECCall(socket, callRequest);
    }

    // Handle P2P call acceptance (existing logic)
    const channelId = this.bot.getAvailableCallChannel();
    if (channelId === null) {
      console.log(chalk.yellow('acceptCall'), socket.id, 'No channel available for call', callId);
      this.rejectCall(socket.id, callId);
      return false;
    }

    callRequest.channel = channelId;

    // @ts-expect-error
    if (!(callRequest.getReceivers().some(p => p.getDiscordId() === socket.discordId))) {
      console.log(chalk.yellow('acceptCall'), socket.id, 'The person answering is not on the call?', callId);
      this.rejectCall(socket.id, callId);
      return false;
    }

    // @ts-expect-error
    const moveSocketResult = await this.movePlayerToCall(socket.discordId, callRequest.channel)
    if(!moveSocketResult) {
      console.log(chalk.yellow('acceptCall'), socket.id, 'Failed to move player to call', callId);
      this.rejectCall(socket.id, callId);
      return false;
    }
    console.log('accepted', callRequest);
    if (callRequest.status === CallRequest.STATUS.OFFERED) {
      console.log(chalk.yellow('acceptCall'), 'Moving sender to call...', callId);
      const result = await this.movePlayerToCall(callRequest.sender.getDiscordId(), callRequest.channel);
      if(!result) {
        console.log(chalk.red('acceptCall'), socket.id, 'Failed to move sender to call', callId);
        this.rejectCall(socket.id, callId);
        // @ts-expect-error
        await this.bot.setUserVoiceChannel(socket.discordId);
        return false;
      }
    }

    if (callRequest.status === CallRequest.STATUS.OFFERED) {
      this.requestedCalls = this.requestedCalls.filter(c => c.id !== callId);
      callRequest.status = CallRequest.STATUS.ACCEPTED;
      this.ongoingCalls.push(callRequest);
      this.sendCallQueueUpdateToPhones(callRequest.getReceivers());
      this.sendCallQueueUpdateToPhones([callRequest.sender]);
    }

    return true;
  }

  /**
   * Handle REC call acceptance with special logic for auto-join and player deduplication
   * @param {Socket} socket 
   * @param {CallRequest} callRequest 
   * @returns {Promise<boolean>}
   */
  async acceptRECCall(socket, callRequest) {
    // @ts-expect-error
    const discordId = socket.discordId;
    
    // Check if player is already on a REC call
    if (this.isPlayerOnRECCall(discordId)) {
      console.log(chalk.yellow('acceptRECCall'), 'Player already on REC call, cannot auto-join another:', discordId);
      return false;
    }

    // Get or assign a channel for the REC call
    if (!callRequest.channel) {
      const channelId = this.bot.getAvailableCallChannel();
      if (channelId === null) {
        console.log(chalk.yellow('acceptRECCall'), socket.id, 'No channel available for REC call', callRequest.id);
        return false;
      }
      callRequest.channel = channelId;
    }

    // Move player to the REC call
    const moveResult = await this.movePlayerToCall(discordId, callRequest.channel);
    if (!moveResult) {
      console.log(chalk.yellow('acceptRECCall'), socket.id, 'Failed to move player to REC call', callRequest.id);
      return false;
    }

    // If this is the first person joining, move the call to ongoing
    if (callRequest.status === CallRequest.STATUS.OFFERED) {
      this.requestedCalls = this.requestedCalls.filter(c => c.id !== callRequest.id);
      callRequest.status = CallRequest.STATUS.ACCEPTED;
      this.ongoingCalls.push(callRequest);
      
      // Move sender to call if they haven't joined yet
      if (callRequest.sender.getDiscordId() !== discordId) {
        await this.movePlayerToCall(callRequest.sender.getDiscordId(), callRequest.channel);
      }
    }

    // Update call queues for all participants
    this.sendCallQueueUpdateToPhones(callRequest.getReceivers());
    this.sendCallQueueUpdateToPhones([callRequest.sender]);

    // Emit joined call event
    this.io.to(discordId).emit("joinedCall", { "success": true });

    console.log(chalk.green('acceptRECCall'), 'Player joined REC call:', discordId, 'call:', callRequest.id);
    return true;
  }

  /**
   * Check if a player is currently on any REC call
   * @param {string} discordId 
   * @returns {boolean}
   */
  isPlayerOnRECCall(discordId) {
    return this.ongoingCalls.some(call => 
      call.type === CallRequest.TYPES.REC && 
      (call.sender.getDiscordId() === discordId || 
       call.getReceivers().some(phone => phone.getDiscordId() === discordId))
    );
  }

  /**
   * 
   * @param {string} socketId 
   * @param {string} callId 
   * @returns {boolean} - Returns true if call was successfully rejected, false otherwise
   */
  rejectCall(socketId, callId) {
    try {
      // Validate input parameters
      if (!socketId || typeof socketId !== 'string') {
        console.error(chalk.red('rejectCall'), 'Invalid socketId provided:', socketId);
        return false;
      }

      if (!callId || typeof callId !== 'string') {
        console.error(chalk.red('rejectCall'), 'Invalid callId provided:', callId);
        return false;
      }

      // Find the call in requested calls
      const call = this.requestedCalls.find(c => c.id === callId);
      if (typeof call === 'undefined') {
        console.log(chalk.yellow('rejectCall'), socketId, 'attempting to reject undefined call', callId);
        return false;
      }

      // Verify call is in a rejectable state
      if (call.status !== CallRequest.STATUS.OFFERED) {
        console.warn(chalk.yellow('rejectCall'), socketId, 'attempting to reject call with status:', call.status, 'callId:', callId);
        return false;
      }

      // Update call status
      try {
        call.status = CallRequest.STATUS.REJECTED;
      } catch (error) {
        console.error(chalk.red('rejectCall'), 'Failed to update call status:', error.message);
        return false;
      }

      // Remove call from requested calls and add to past calls
      try {
        this.requestedCalls = this.requestedCalls.filter(c => c.id !== callId);
        this.pastCalls.push(call);
      } catch (error) {
        console.error(chalk.red('rejectCall'), 'Failed to move call between arrays:', error.message);
        // Attempt to restore original status
        try {
          call.status = CallRequest.STATUS.OFFERED;
        } catch (restoreError) {
          console.error(chalk.red('rejectCall'), 'Failed to restore call status after array operation failure:', restoreError.message);
        }
        return false;
      }

      // Terminate the channel and move players back to original channels if channel exists
      try {
        if (call.channel && this.bot && typeof this.bot.terminateCallForChannel === 'function') {
          const senderId = call.sender ? call.sender.getDiscordId() : null;
          this.bot.terminateCallForChannel(call.channel, senderId, 'COMPLETED')
            .then(success => {
              if (success) {
                console.log(chalk.green('rejectCall'), 'Channel terminated and players moved back:', call.channel);
              } else {
                console.warn(chalk.yellow('rejectCall'), 'Failed to properly terminate channel:', call.channel);
              }
            })
            .catch(error => {
              console.error(chalk.red('rejectCall'), 'Error terminating channel:', error);
            });
        } else if (call.channel) {
          console.warn(chalk.yellow('rejectCall'), 'Bot or terminateCallForChannel method not available for channel:', call.channel);
        }
      } catch (error) {
        console.error(chalk.red('rejectCall'), 'Failed to terminate call channel:', error.message, 'channel:', call.channel);
        // Don't return false here as the core rejection logic succeeded
      }
      
      // Send call queue updates for P2P calls
      if (call.type === CallRequest.TYPES.P2P) {
        try {
          // Get receivers and validate they exist
          const receivers = call.getReceivers();
          if (Array.isArray(receivers) && receivers.length > 0) {
            this.sendCallQueueUpdateToPhones(receivers);
          } else {
            console.warn(chalk.yellow('rejectCall'), 'No valid receivers found for P2P call:', callId);
          }

          // Send update to sender if sender exists
          if (call.sender) {
            this.sendCallQueueUpdateToPhones([call.sender]);
          } else {
            console.warn(chalk.yellow('rejectCall'), 'No sender found for call:', callId);
          }
        } catch (error) {
          console.error(chalk.red('rejectCall'), 'Failed to send call queue updates:', error.message, 'callId:', callId);
          // Don't return false here as the core rejection logic succeeded
        }
      }

      console.log(chalk.green('rejectCall'), 'Successfully rejected call:', callId, 'from socket:', socketId);
      return true;

    } catch (error) {
      console.error(chalk.red('rejectCall'), 'Unexpected error occurred:', error.message, 'callId:', callId, 'socketId:', socketId);
      console.error(chalk.red('rejectCall'), 'Stack trace:', error.stack);
      return false;
    }
  }

  /**
   * @param {string} discordId 
   * @param {string} call 
   * @returns 
   */
  async movePlayerToCall(discordId, call) {
    return await this.bot.setUserVoiceChannel(discordId, call);
  }

  /**
   * @param {string} socketId 
   * @param {string} callId 
   */
  async leaveCall(socketId, callId) {
    const call = this.ongoingCalls.find(c => c.id === callId);
    if (typeof call !== 'undefined') {
      //@ts-expect-error
      const leaversDiscordId = this.io.sockets.sockets.get(socketId).discordId;

      if (call.type === CallRequest.TYPES.P2P) {
        await this.bot.setUserVoiceChannel(call.sender.getDiscordId());
        await this.bot.setUserVoiceChannel(call.getReceiver().getDiscordId());

        if (leaversDiscordId === call.sender.getDiscordId()) {
          this.io.to(call.getReceiver().getDiscordId()).emit("kickedFromCall", { "success": true });
        } else {
          this.io.to(call.sender.getDiscordId()).emit("kickedFromCall", { "success": true });
        }

        // Terminate the channel and move players back to original channels
        if (call.channel) {
          const senderId = call.sender ? call.sender.getDiscordId() : null;
          this.bot.terminateCallForChannel(call.channel, senderId, 'COMPLETED')
            .then(success => {
              if (success) {
                console.log(chalk.green('leaveCall'), 'Channel terminated and players moved back for P2P call:', call.channel);
              } else {
                console.warn(chalk.yellow('leaveCall'), 'Failed to properly terminate channel for P2P call:', call.channel);
              }
            })
            .catch(error => {
              console.error(chalk.red('leaveCall'), 'Error terminating channel for P2P call:', error);
            });
        }

        call.status = CallRequest.STATUS.ENDED;
        this.ongoingCalls = this.ongoingCalls.filter(c => c.id !== callId);
        this.pastCalls.push(call);
        this.sendCallQueueUpdateToPhones(call.getReceivers());
        this.sendCallQueueUpdateToPhones([call.sender]);
      } else if (call.type === CallRequest.TYPES.REC) {
        // Handle REC call leaving
        await this.leaveRECCall(socketId, call, leaversDiscordId);
      }

    } else {
      console.info(chalk.yellow('leaveCall'), 'Call already terminated.', callId)
    }
  }

  /**
   * Handle leaving a REC call with last-person-leaves termination logic
   * @param {string} socketId 
   * @param {CallRequest} call 
   * @param {string} leaversDiscordId 
   */
  async leaveRECCall(socketId, call, leaversDiscordId) {
    if (this.groupCallManager) {
      try {
        return await this.groupCallManager.leaveRECCall(socketId, call, leaversDiscordId);
      } catch (error) {
        // Fall through to legacy handling
      }
    } else {
      console.warn(chalk.yellow('leaveRECCall'), 'GroupCallManager not available, using legacy REC handling');
    }
    
    try {
      // Move the leaving player back to their original channel
      await this.bot.setUserVoiceChannel(leaversDiscordId);

      // Get all participants in the REC call
      const allParticipants = [call.sender, ...call.getReceivers()];
      const remainingParticipants = allParticipants.filter(phone => 
        phone.getDiscordId() !== leaversDiscordId && phone.getDiscordId() !== null
      );

      console.log(chalk.blue('leaveRECCall'), `Legacy termination: ${remainingParticipants.length} participants remaining in call ${call.id}`);

      if (remainingParticipants.length === 0) {
        call.status = CallRequest.STATUS.ENDED;
        this.ongoingCalls = this.ongoingCalls.filter(c => c.id !== call.id);
        this.pastCalls.push(call);

        if (call.channel) {
          const senderId = call.sender ? call.sender.getDiscordId() : null;
          this.bot.terminateCallForChannel(call.channel, senderId, 'COMPLETED').catch(() => {});
        }
      }

      this.sendCallQueueUpdateToPhones(call.getReceivers());
      this.sendCallQueueUpdateToPhones([call.sender]);

      return true;
    } catch (error) {
      return false;
    }
  }
}
