//@ts-check
import chalk from 'chalk';
import CallRequest from './model/callrequest.js';
/** @typedef {import("./model/phone.js").default} Phone */
/** @typedef {import("./bot.js").default} DiscordBot */
/** @typedef {import("./phonemanager.js").default} PhoneManager */
/** @typedef {import("socket.io").Server} Server */
/** @typedef {import("socket.io").Socket} Socket */

export default class CallManager {

  privateCalls = {};
  //callQueue = {};

  /** @type {CallRequest[]} */
  requestedCalls = [];
  /** @type {CallRequest[]} */
  ongoingCalls = [];
  /** @type {CallRequest[]} */
  pastCalls = [];


  /**
   * 
   * @param {PhoneManager} phoneManager 
   * @param {DiscordBot} bot 
   * @param {Server} io 
   */
  constructor(phoneManager, bot, io) {
    this.phoneManager = phoneManager;
    this.bot = bot;
    this.io = io;
  }


  /**
   * 
   * @param {Phone} phone 
   * @returns {CallRequest[]}
   */
  getCallQueueForPhone(phone) {
    const requestedCalls = this.requestedCalls.filter((c) => (c.isForPhone(phone) || c.isFromPhone(phone)));
    const ongoingCalls = this.ongoingCalls.filter((c) => (c.isForPhone(phone) || c.isFromPhone(phone)));
    const pastCalls = this.pastCalls.filter((c) => (c.isForPhone(phone) || c.isFromPhone(phone)));
    
    // Get current calls (requested + ongoing)
    const toNowCalls = requestedCalls.concat(ongoingCalls);

    // Add last 10 past calls
    const last10PastCalls = pastCalls.slice(-10);
    toNowCalls.push(...last10PastCalls);

    return toNowCalls;
  }


  /**
   * 
   * @param {string} socketId 
   * @param {string} callType 
   * @param {string} callLevel
   * @param {string} senderPhoneId 
   * @param {object[]|null} receiverPhones 
   * @returns 
   */
  placeCall(socketId, callType, callLevel, senderPhoneId, receiverPhones = null) {
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
        //console.info(chalk.yellow("Placing Call"), chalk.magentaBright("Caller:"), sendingPlayerId, chalk.magentaBright("Reciever:"), receivingPlayerId);
        callRequest = new CallRequest(sendingPhone, receivingPhone, callType, callLevel);
      } else {
        console.info(chalk.yellow('placeCall'), chalk.yellow("A player ("), sendingPlayerId, chalk.yellow(") tried to call themselves as was rejected."));
        return false
      }
    } else if (callType === CallRequest.TYPES.REC) {
      // REC calls must be EMERGENCY level only
      if (callLevel !== CallRequest.LEVELS.EMERGENCY) {
        console.info(chalk.yellow('placeCall'), chalk.yellow("A player ("), sendingPlayerId, chalk.yellow(") tried to place REC call with non-EMERGENCY level:"), callLevel);
        return false;
      }
      
      const recPhones = this.phoneManager.getRECRecipientsForPhone(sendingPhone);
      if (recPhones.length > 0) {
        console.log(chalk.magenta('RECPHONES'), typeof recPhones, Array.isArray(recPhones), recPhones);
        callRequest = new CallRequest(sendingPhone, recPhones, CallRequest.TYPES.REC, CallRequest.LEVELS.EMERGENCY);
      } else {
        console.info(chalk.yellow('placeCall'), chalk.yellow("A player ("), sendingPlayerId, chalk.yellow(") tried to REC but there were no receivers."));
        return false
      }
    } else {
      console.info(chalk.yellow('placeCall'), chalk.yellow("A player ("), sendingPlayerId, chalk.yellow(") tried to place an invalid call type."), callType);
      return false;
    }

    this.requestedCalls.push(callRequest);

    console.log(chalk.yellow("Placing call"), callRequest.toEmittable());

    // Send new call notifications
    this.sendNewCallNotifications(callRequest);

    // Update call queues
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
        this.io.to(phone.getDiscordId()).emit('newCallInQueue', callRequest.toEmittable());
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

      // Release private call channel reservation if channel exists
      try {
        if (call.channel && this.bot && typeof this.bot.releasePrivateCallChannelReservation === 'function') {
          this.bot.releasePrivateCallChannelReservation(call.channel);
        } else if (call.channel) {
          console.warn(chalk.yellow('rejectCall'), 'Bot or releasePrivateCallChannelReservation method not available for channel:', call.channel);
        }
      } catch (error) {
        console.error(chalk.red('rejectCall'), 'Failed to release private call channel reservation:', error.message, 'channel:', call.channel);
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
   * 
   * @param {string} discordId 
   * @param {string} call 
   * @returns 
   */
  async movePlayerToCall(discordId, call) {
    console.log(chalk.blueBright("callManager"), chalk.yellow("movePlayerToCall"), discordId, call);
    const result = await this.bot.setUserVoiceChannel(discordId, call);
    return result;
  }

  /**
   * 
   * @param {string} socketId 
   * @param {string} callId 
   */
  async leaveCall(socketId, callId) {
    console.log('leaving', callId);
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

        // Release the channel reservation
        if (call.channel) {
          this.bot.releasePrivateCallChannelReservation(call.channel);
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
    // Move the leaving player back to their original channel
    await this.bot.setUserVoiceChannel(leaversDiscordId);

    // Get all participants in the REC call
    const allParticipants = [call.sender, ...call.getReceivers()];
    const remainingParticipants = allParticipants.filter(phone => 
      phone.getDiscordId() !== leaversDiscordId && phone.getDiscordId() !== null
    );

    console.log(chalk.yellow('leaveRECCall'), 'Remaining participants:', remainingParticipants.length);

    // If this was the last person, terminate the call
    if (remainingParticipants.length === 0) {
      console.log(chalk.yellow('leaveRECCall'), 'Last person left, terminating REC call:', call.id);
      
      call.status = CallRequest.STATUS.ENDED;
      this.ongoingCalls = this.ongoingCalls.filter(c => c.id !== call.id);
      this.pastCalls.push(call);

      // Release the channel
      if (call.channel) {
        this.bot.releasePrivateCallChannelReservation(call.channel);
      }
    }

    // Update call queues for all phones
    this.sendCallQueueUpdateToPhones(call.getReceivers());
    this.sendCallQueueUpdateToPhones([call.sender]);

    console.log(chalk.green('leaveRECCall'), 'Player left REC call:', leaversDiscordId, 'call:', call.id);
  }


  // =============================== END CALL CODE ===============================

  // REc
  playerJoinREC(playerId, channelId) {
    console.log(chalk.yellow("Player joining REC:"), chalk.white(playerId));
    this.movePlayerToCall(playerId, channelId);
    this.io.to(playerId).emit("joinedCall", { "success": true });
  }

  kickUserFromCall(discordId) {
    console.log(discordId);
  }
}
