// @ts-check
import chalk from 'chalk';

/** @typedef {import("./ROCManager.js").default} ROCManager */
/** @typedef {import("./callManager.js").default} CallManager */
/** @typedef {import("./model/player.js").default} Player */
/** @typedef {import("socket.io").Socket} Socket */

/**
 * 
 * @param {Socket} socket 
 * @param {ROCManager} gameManager
 * @param {CallManager} callManager 
 */
export function rocSockets (socket, gameManager, callManager) {  

  socket.on('newPlayer', function (msg) {
    console.info(chalk.yellow("Event newPlayer", "New Player has joined the WebUI"));
    gameManager.registerWebUI(socket, msg.discordId);
  });

  socket.on('playerQuit', function(){
    gameManager.deletePlayer(gameManager.findPlayerBySocketId(socket.id));
  });

  socket.on('moveToLobby', function(){
    gameManager.movePlayerToLobby(socket.id);
  });

  socket.on('markAFK', function(){
    gameManager.markPlayerAFK(socket.id);
  });

  socket.on('updatePlayerPanel', function(msg){
    gameManager.updatePlayerPanel(msg.user, msg.panel)
  });

  socket.on('claimPanel', function(msg){
    gameManager.claimPanel(msg.sender, msg.sim, msg.panel)
  });

  socket.on('releasePanel', function(msg){
    gameManager.releasePanel(msg.sender, msg.sim, msg.panel)
  });

  socket.on('movePlayerVoiceChannel', function(msg){
    gameManager.movePlayerToVoiceChannel(msg.user, msg.channel);
  });

  socket.on("requestPhoneQueueUpdate", function(msg){
    callManager.requestPhoneQueueUpdate(msg.id);
  });

  socket.on("placeCall", async function(msg,callback){
    // Handle both old format (receiver) and new format (receivers)
    let receivers = msg.receivers;
    if (!receivers && msg.receiver) {
      // Convert old format to new format
      receivers = [{ id: msg.receiver }];
    }
    
    // For REC calls, sender is the phone ID, not an object
    const senderId = typeof msg.sender === 'object' ? msg.sender.id : msg.sender;
    
    try {
      // TASK-032: Route REC calls through GroupCallManager instead of CallManager
      if (msg.type === 'REC') {
        console.log(chalk.green('placeCall'), 'Routing REC call to GroupCallManager');
        const groupCallManager = callManager.groupCallManager;
        if (!groupCallManager) {
          throw new Error('GroupCallManager not available for REC calls');
        }
        
        const response = await groupCallManager.placeRECCall(socket.id, senderId);
        callback(response);
      } else {
        // Route regular P2P calls through CallManager as before
        const response = await callManager.placeCall(socket.id, msg.type, msg.level, senderId, receivers);
        callback(response);
      }
    } catch (error) {
      console.error('Error placing call:', error);
      callback(false);
    }
  });

  socket.on("rejectCall", function(msg, callback){
    const result = callManager.rejectCall(socket.id,msg.id);
    if (callback && typeof callback === 'function') {
      callback({ success: result });
    }
  });
  
  socket.on("acceptCall", async function(msg, callback){
    try {
      const response = await callManager.acceptCall(socket, msg.id);
      if (callback && typeof callback === 'function') {
        callback(response);
      }
    } catch (error) {
      console.error('Error accepting call:', error);
      if (callback && typeof callback === 'function') {
        callback(false);
      }
    }
  });

  socket.on("leaveCall", function(msg){
    callManager.leaveCall(socket.id, msg.id);
  });

  socket.on("joinREC", function(msg){
    callManager.playerJoinREC(msg.user, msg.channel);
  });

  // TASK-031: Group call event handlers for Phase 6 socket integration
  socket.on("startGroupCall", async function(msg, callback) {
    console.log(chalk.yellow('startGroupCall'), msg);
    try {
      // Route group calls through GroupCallManager
      const groupCallManager = callManager.groupCallManager;
      if (!groupCallManager) {
        throw new Error('GroupCallManager not available');
      }

      // Handle REC calls specifically
      if (msg.type === 'REC') {
        const response = await groupCallManager.placeRECCall(socket.id, msg.senderPhoneId);
        if (callback && typeof callback === 'function') {
          callback(response);
        }
      } else {
        // Handle other group call types (future expansion)
        console.warn(chalk.yellow('startGroupCall'), `Group call type ${msg.type} not yet implemented`);
        if (callback && typeof callback === 'function') {
          callback(false);
        }
      }
    } catch (error) {
      console.error('Error starting group call:', error);
      if (callback && typeof callback === 'function') {
        callback(false);
      }
    }
  });

  socket.on("joinGroupCall", async function(msg, callback) {
    console.log(chalk.yellow('joinGroupCall'), msg);
    try {
      const groupCallManager = callManager.groupCallManager;
      if (!groupCallManager) {
        throw new Error('GroupCallManager not available');
      }

      const response = await groupCallManager.joinGroupCall(socket.id, msg.phoneId, msg.groupId);
      if (callback && typeof callback === 'function') {
        callback(response);
      }
    } catch (error) {
      console.error('Error joining group call:', error);
      if (callback && typeof callback === 'function') {
        callback(false);
      }
    }
  });

  socket.on("leaveGroupCall", async function(msg, callback) {
    console.log(chalk.yellow('leaveGroupCall'), msg);
    try {
      const groupCallManager = callManager.groupCallManager;
      if (!groupCallManager) {
        throw new Error('GroupCallManager not available');
      }

      const response = await groupCallManager.leaveGroupCall(socket.id, msg.phoneId);
      if (callback && typeof callback === 'function') {
        callback(response);
      }
    } catch (error) {
      console.error('Error leaving group call:', error);
      if (callback && typeof callback === 'function') {
        callback(false);
      }
    }
  });

  // Debug socket event for mobile station states
  socket.on("debugMobileStations", function(msg, callback) {
    console.log(chalk.cyan('debugMobileStations'), msg);
    try {
      const groupCallManager = callManager.groupCallManager;
      if (!groupCallManager) {
        throw new Error('GroupCallManager not available');
      }

      let response;
      if (msg.phoneId) {
        response = groupCallManager.getMobileStationDebugInfo(msg.phoneId);
      } else {
        response = groupCallManager.getAllMobileStationDebugInfo();
      }

      if (callback && typeof callback === 'function') {
        callback(response);
      }
    } catch (error) {
      console.error('Error getting mobile station debug info:', error);
      if (callback && typeof callback === 'function') {
        callback({ error: error.message });
      }
    }
  });

  socket.on("terminateGroupCall", async function(msg, callback) {
    console.log(chalk.yellow('terminateGroupCall'), msg);
    try {
      const groupCallManager = callManager.groupCallManager;
      if (!groupCallManager) {
        throw new Error('GroupCallManager not available');
      }

      const response = await groupCallManager.terminateGroupCall(socket.id, msg.phoneId);
      if (callback && typeof callback === 'function') {
        callback(response);
      }
    } catch (error) {
      console.error('Error terminating group call:', error);
      if (callback && typeof callback === 'function') {
        callback(false);
      }
    }
  });

  socket.on("acceptGroupCall", async function(msg, callback) {
    console.log(chalk.yellow('acceptGroupCall'), msg);
    try {
      const groupCallManager = callManager.groupCallManager;
      if (!groupCallManager) {
        throw new Error('GroupCallManager not available');
      }

      // Handle REC call acceptance specifically
      if (msg.type === 'REC') {
        const response = await groupCallManager.acceptRECCall(socket, msg.callRequest);
        if (callback && typeof callback === 'function') {
          callback(response);
        }
      } else {
        // Handle other group call acceptance (future expansion)
        console.warn(chalk.yellow('acceptGroupCall'), `Group call type ${msg.type} acceptance not yet implemented`);
        if (callback && typeof callback === 'function') {
          callback(false);
        }
      }
    } catch (error) {
      console.error('Error accepting group call:', error);
      if (callback && typeof callback === 'function') {
        callback(false);
      }
    }
  });

  socket.on("requestGroupCallUpdate", function(msg) {
    console.log(chalk.yellow('requestGroupCallUpdate'), msg);
    try {
      const groupCallManager = callManager.groupCallManager;
      if (groupCallManager) {
        // Send current group call state to requesting client
        const activeGroupCalls = groupCallManager.getAllActiveGroupCalls();
        socket.emit('groupCallUpdate', activeGroupCalls);
      }
    } catch (error) {
      console.error('Error getting group call update:', error);
    }
  });

  socket.on("requestGameUpdate", () => {
    gameManager.sendGameUpdateToSocket(socket);
  });

  socket.on('disconnect', function(msg){
    gameManager.checkDisconnectingPlayer(gameManager.findPlayerBySocketId(socket.id));
    console.log(chalk.yellow("Disconnect"), chalk.white("A socket has disconnected"), socket.id, msg);
  });
}
