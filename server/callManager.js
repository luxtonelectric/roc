//@ts-check
import chalk from 'chalk';
import CallRequest from './model/callrequest.js';
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
   * @param {string} socketId 
   * @param {string} callType 
   * @param {string} senderPhoneId 
   * @param {string|null} receiverPhoneId 
   * @returns 
   */
  placeCall(socketId, callType, senderPhoneId, receiverPhoneId = null) {
    if (typeof this.phoneManager.getPhone(receiverPhoneId) === 'undefined') {
      console.warn(chalk.yellow('placeCall'), chalk.red("Receiver phone not valid: "), receiverPhoneId, senderPhoneId);
      //this.io.to(socketId).emit('rejectCall', {"success":false})
      return false;
    }

    if (this.phoneManager.getPhone(receiverPhoneId).discordId === null) {
      console.warn(chalk.yellow('placeCall'), chalk.red("Receiver phone not assigned to a player: "), receiverPhoneId, senderPhoneId);
      //this.io.to(socketId).emit('rejectCall', {"success":false})
      return false;
    }

    if (typeof this.phoneManager.getPhone(senderPhoneId) === 'undefined') {
      console.warn(chalk.yellow('placeCall'), chalk.red("Sender phone not valid: "), receiverPhoneId, senderPhoneId);
      //this.io.to(socketId).emit('rejectCall', {"success":false})
      return false;
    }

    if (this.phoneManager.getPhone(senderPhoneId).discordId === null) {
      console.warn(chalk.yellow('placeCall'), chalk.red("Sender phone not assigned to a player: "), receiverPhoneId, senderPhoneId);
      //this.io.to(socketId).emit('rejectCall', {"success":false})
      return false;
    }

    const sendingPhone = this.phoneManager.getPhone(senderPhoneId);
    const sendingPlayerId = sendingPhone.discordId;
    //const sendingPlayer = this.players[sendingPlayerId];

    let callRequest;

    if (callType === CallRequest.TYPES.P2P) {
      const receivingPhone = this.phoneManager.getPhone(receiverPhoneId);
      const receivingPlayerId = receivingPhone.discordId;
      //const receivingPlayer = this.players[receivingPlayerId];

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
    console.log(chalk.yellow("Placing call"), callRequest);
    const localIO = this.io;
    callRequest.getReceivers().forEach(p => {
      localIO.to(p.discordId).emit("newCallInQueue", callRequest);
    })
    //console.log('newCallinQueue', callRequest);
    return callRequest.id;

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
    if (!(callRequest.getReceivers().some(p => p.discordId === socket.discordId))) {
      console.log(chalk.yellow('acceptCall'), socket.id, 'The person answering is not on the call?', callId);
      socket.emit('rejectCall', { "success": false })
      return false;
    }

    // @ts-expect-error
    await this.movePlayerToCall(socket.discordId, callRequest.channel)
    console.log('accpeted', callRequest);
    if (callRequest.status === CallRequest.STATUS.OFFERED) {
      console.log(chalk.yellow('acceptCall'), 'Moving sender to call...', callId);
      await this.movePlayerToCall(callRequest.sender.discordId, callRequest.channel);
    }

    if (callRequest.status === CallRequest.STATUS.OFFERED) {
      this.requestedCalls = this.requestedCalls.filter(c => c.id !== callId);
      callRequest.status = CallRequest.STATUS.ACCEPTED;
      this.ongoingCalls.push(callRequest);
    }
  }

  rejectCall(socketId, callId) {

    const call = this.requestedCalls.find(c => c.id === callId);
    if (typeof call === 'undefined') {
      return false;
    }

    call.status = CallRequest.STATUS.REJECTED;
    this.requestedCalls = this.requestedCalls.filter(c => c.id !== callId);
    this.bot.releasePrivateCallChannelReservation(call.channel)
    this.io.to(call.sender.discordId).emit("rejectCall", { "success": false });
    if (call.type === CallRequest.TYPES.P2P) {
      this.io.to(call.getReceiver().discordId).emit('removeCallFromQueue', call);
    }
  }

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

  async leaveCall(socketId, callId) {
    console.log('leaving', callId);
    const call = this.ongoingCalls.find(c => c.id === callId);
    if (typeof call !== 'undefined') {
      if (call.type === CallRequest.TYPES.P2P) {
        console.log()

        //@ts-expect-error
        const leaversDiscordId = this.io.sockets.sockets.get(socketId).discordId


        await this.bot.setUserVoiceChannel(call.sender.discordId);
        await this.bot.setUserVoiceChannel(call.getReceiver().discordId);

        if (leaversDiscordId === call.sender.discordId) {
          this.io.to(call.getReceiver().discordId).emit("kickedFromCall", { "success": true });
        } else {
          this.io.to(call.sender.discordId).emit("kickedFromCall", { "success": true });
        }

        call.status = CallRequest.STATUS.ENDED;
        this.requestedCalls = this.requestedCalls.filter(c => c.id !== callId);
        this.pastCalls.push(call);
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

  // playerStartREC(playerId, phoneId) {
  //     console.log(chalk.yellow("playerStartREC"), chalk.magenta("REC started for"), panelId, chalk.magenta("by"), playerId);

  //     const phone = this.phoneManager.getPhone(phoneId);

  //     const panelParts = panelId.split(".");
  //       if(panelParts.length !== 2 || typeof this.sims[panelParts[0]] === "undefined" || typeof this.sims[panelParts[0]].panels[panelParts[1]] === "undefined") {
  //         console.log("REC Started for invalid panelId", panelId);
  //         return false;
  //       }

  //     const available = this.bot.getAvailableCallChannel();
  //     if(available !== null) {     
  //       //First get the list of players to call... 
  //       // const playersToCall = [];
  //       // const panel = this.sims[panelParts[0]].panels[panelParts[1]];

  //       // if(typeof panel.neighbours !== 'undefined') {
  //       //   for (let index = 0; index < panel.neighbours.length; index++) {
  //       //     const neighbourPanelId = panel.neighbours[index];
  //       //     const neighbourPanelParts = neighbourPanelId.split(".");
  //       //     if(neighbourPanelParts.length == 1) {
  //       //       neighbourPanelParts.unshift(panelParts[0]);
  //       //     }
  //       //     const neighbourPanel = this.sims[neighbourPanelParts[0]].panels[neighbourPanelParts[1]];
  //       //     if(typeof neighbourPanel.player !== 'undefined') {
  //       //       playersToCall.push(neighbourPanel.player);
  //       //     }
  //       //   }  
  //       // }

  //       // const uniquePlayersToCall = [...new Set(playersToCall)];
  //       // if(uniquePlayersToCall.indexOf(playerId) >-1 ) {
  //       //   uniquePlayersToCall.splice(uniquePlayersToCall.indexOf(playerId),1)
  //       // }

  //       const recPhones = this.phoneManager.getRECRecipientsForPhone();


  //       //Actually call people
  //       this.privateCalls[available].push(playerId);
  //       this.playerJoinREC(playerId,available);

  //       uniquePlayersToCall.forEach(playerIdToCall => {
  //         console.log(chalk.blueBright("playerStartREC"), chalk.yellow("Calling players..."), chalk.white(), playerIdToCall);
  //         var player = this.players[playerIdToCall];
  //         this.privateCalls[available].push(playerIdToCall);
  //         this.io.to(player.socket.id).emit('incomingREC',{"initiator":panelId ,"channel":available});
  //       })
  //     } else {
  //       console.log(chalk.red("REC Failed due to no available call channels"))
  //     }

  //   }

  kickUserFromCall(discordId) {
    console.log(discordId);
    // console.info(chalk.yellow("Admin kicking user"), chalk.green(discordId), chalk.yellow("from a private call"));
    // var user = this.players[data.user];
    // if(user)
    // {
    //   this.io.in(discordId).emit("kickedFromCall", {"success": true});
    // }
    // else
    // {
    //   for(var call in this.privateCalls)
    //   {
    //     if(this.privateCalls[call] != null || this.privateCalls[call] != [])
    //     {
    //       if(this.privateCalls[call].indexOf(discordId)>-1)
    //       {
    //         //console.log(this.privateCalls[call]);
    //         var index = this.privateCalls[call].indexOf(discordId);
    //         if (index !== -1) {
    //           this.privateCalls[call].splice(index, 1);
    //         }
    //       }
    //     }
    //   }
    // }
  }
}