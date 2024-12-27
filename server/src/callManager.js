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
    const requestedCalls = this.requestedCalls.filter((c) => c.isForPhone(phone) || c.isFromPhone(phone));
    const ongoingCalls = this.ongoingCalls.filter((c) => c.isForPhone(phone) || c.isFromPhone(phone));

    return requestedCalls.concat(ongoingCalls);
  }


  /**
   * 
   * @param {string} socketId 
   * @param {string} callType 
   * @param {string} senderPhoneId 
   * @param {string|null} receiverPhoneId 
   * @returns 
   */
  placeCall(socketId, callType, senderPhoneId, receiverPhoneId = null) {

    if (typeof this.phoneManager.getPhone(senderPhoneId) === 'undefined') {
      console.warn(chalk.yellow('placeCall'), chalk.red("Sender phone not valid: "), receiverPhoneId, senderPhoneId);
      //this.io.to(socketId).emit('rejectCall', {"success":false})
      return false;
    }

    if (this.phoneManager.getPhone(senderPhoneId).getDiscordId() === null) {
      console.warn(chalk.yellow('placeCall'), chalk.red("Sender phone not assigned to a player: "), receiverPhoneId, senderPhoneId);
      //this.io.to(socketId).emit('rejectCall', {"success":false})
      return false;
    }

    const sendingPhone = this.phoneManager.getPhone(senderPhoneId);

    const sendingPlayerId = sendingPhone.getDiscordId();

    let callRequest;

    if (callType === CallRequest.TYPES.P2P) {
      if (typeof this.phoneManager.getPhone(receiverPhoneId) === 'undefined') {
        console.warn(chalk.yellow('placeCall'), chalk.red("Receiver phone not valid: "), receiverPhoneId, senderPhoneId);
        //this.io.to(socketId).emit('rejectCall', {"success":false})
        return false;
      }

      if (this.phoneManager.getPhone(receiverPhoneId).getDiscordId() === null) {
        console.warn(chalk.yellow('placeCall'), chalk.red("Receiver phone not assigned to a player: "), receiverPhoneId, senderPhoneId);
        //this.io.to(socketId).emit('rejectCall', {"success":false})
        return false;
      }
      const receivingPhone = this.phoneManager.getPhone(receiverPhoneId);
      const receivingPlayerId = receivingPhone.getDiscordId();

      if (sendingPlayerId !== receivingPlayerId) {
        //console.info(chalk.yellow("Placing Call"), chalk.magentaBright("Caller:"), sendingPlayerId, chalk.magentaBright("Reciever:"), receivingPlayerId);
        callRequest = new CallRequest(sendingPhone, receivingPhone);
      } else {
        console.info(chalk.yellow('placeCall'), chalk.yellow("A player ("), sendingPlayerId, chalk.yellow(") tried to call themselves as was rejected."));
        //this.io.to(socketId).emit('rejectCall', {"success":false})
        return false
      }
    } else if (callType === CallRequest.TYPES.REC) {
      const recPhones = this.phoneManager.getRECRecipientsForPhone(sendingPhone);
      if (recPhones.length > 0) {
        console.log(chalk.magenta('RECPHONES'), typeof recPhones, Array.isArray(recPhones), recPhones);
        callRequest = new CallRequest(sendingPhone, recPhones, CallRequest.TYPES.REC, CallRequest.LEVELS.EMERGENCY);
      } else {
        console.info(chalk.yellow('placeCall'), chalk.yellow("A player ("), sendingPlayerId, chalk.yellow(") tried to REC but there were no receivers."));
        return false
      }
    }

    this.requestedCalls.push(callRequest);

    console.log(chalk.yellow("Placing call"), callRequest.toEmittable());

    this.sendCallQueueUpdateToPhones(callRequest.getReceivers());
    this.sendCallQueueUpdateToPhones([callRequest.sender]);

    return callRequest.id;

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
   * 
   * @param {Socket} socket 
   * @param {string} callId 
   * @returns 
   */
  async acceptCall(socket, callId) {
    const callRequest = this.requestedCalls.some(x => x.id === callId) ? this.requestedCalls.find(x => x.id === callId) : this.ongoingCalls.find(x => x.id === callId);

    if (typeof callRequest === 'undefined') {
      console.log(chalk.yellow('acceptCall'), socket.id, 'attempting to accept undefined call', callId);
      socket.emit('rejectCall', { "success": false })
      return false;
    }

    const channelId = this.bot.getAvailableCallChannel();
    if (channelId === null) {
      console.log(chalk.yellow('acceptCall'), socket.id, 'No channel available for call', callId);
      socket.emit('rejectCall', { "success": false })
      return false;
    }

    callRequest.channel = channelId;

    // @ts-expect-error
    if (!(callRequest.getReceivers().some(p => p.getDiscordId() === socket.discordId))) {
      console.log(chalk.yellow('acceptCall'), socket.id, 'The person answering is not on the call?', callId);
      socket.emit('rejectCall', { "success": false })
      return false;
    }

    // @ts-expect-error
    await this.movePlayerToCall(socket.discordId, callRequest.channel)
    console.log('accpeted', callRequest);
    if (callRequest.status === CallRequest.STATUS.OFFERED) {
      console.log(chalk.yellow('acceptCall'), 'Moving sender to call...', callId);
      await this.movePlayerToCall(callRequest.sender.getDiscordId(), callRequest.channel);
    }

    if (callRequest.status === CallRequest.STATUS.OFFERED) {
      this.requestedCalls = this.requestedCalls.filter(c => c.id !== callId);
      callRequest.status = CallRequest.STATUS.ACCEPTED;
      this.ongoingCalls.push(callRequest);
      this.sendCallQueueUpdateToPhones(callRequest.getReceivers());
      this.sendCallQueueUpdateToPhones([callRequest.sender]);
    }
  }

  /**
   * 
   * @param {string} socketId 
   * @param {string} callId 
   * @returns 
   */
  rejectCall(socketId, callId) {

    const call = this.requestedCalls.find(c => c.id === callId);
    if (typeof call === 'undefined') {
      return false;
    }

    call.status = CallRequest.STATUS.REJECTED;
    this.requestedCalls = this.requestedCalls.filter(c => c.id !== callId);
    this.bot.releasePrivateCallChannelReservation(call.channel)
    this.io.to(call.sender.getDiscordId()).emit("rejectCall", { "success": false });
    if (call.type === CallRequest.TYPES.P2P) {
      this.io.to(call.getReceiver().getDiscordId()).emit('removeCallFromQueue', call);

      this.sendCallQueueUpdateToPhones(call.getReceivers());
      this.sendCallQueueUpdateToPhones([call.sender]);
    }
  }

  /**
   * 
   * @param {string} discordId 
   * @param {string} call 
   * @returns 
   */
  async movePlayerToCall(discordId, call) {
    console.log(chalk.blueBright("GameManager"), chalk.yellow("movePlayerToCall"), discordId, call);
    const result = await this.bot.setUserVoiceChannel(discordId, call);
    if (result) {
      this.io.to(discordId).emit("joinedCall", { "success": true });
    } else {
      this.io.to(discordId).emit("joinedCall", { "success": false });
    }
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
      if (call.type === CallRequest.TYPES.P2P) {
        //@ts-expect-error
        const leaversDiscordId = this.io.sockets.sockets.get(socketId).discordId


        await this.bot.setUserVoiceChannel(call.sender.getDiscordId());
        await this.bot.setUserVoiceChannel(call.getReceiver().getDiscordId());

        if (leaversDiscordId === call.sender.getDiscordId()) {
          this.io.to(call.getReceiver().getDiscordId()).emit("kickedFromCall", { "success": true });
        } else {
          this.io.to(call.sender.getDiscordId()).emit("kickedFromCall", { "success": true });
        }

        call.status = CallRequest.STATUS.ENDED;
        this.ongoingCalls = this.ongoingCalls.filter(c => c.id !== callId);
        this.pastCalls.push(call);
        this.sendCallQueueUpdateToPhones(call.getReceivers());
        this.sendCallQueueUpdateToPhones([call.sender]);
      }

    } else {
      console.info(chalk.yellow('leaveCall'), 'Call already terminated.', callId)
    }
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