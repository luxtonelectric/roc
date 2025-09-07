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

  socket.on("placeCall", function(msg,callback){
    //TODO: This needs to be updated to handle multiple receivers
    const response = callManager.placeCall(socket.id, msg.type, msg.level, msg.sender.id, msg.receivers);
    callback(response);
  });

  socket.on("rejectCall", function(msg, callback){
    const result = callManager.rejectCall(socket.id,msg.id);
    if (callback && typeof callback === 'function') {
      callback({ success: result });
    }
  });
  
  socket.on("acceptCall", function(msg, callback){
    const response = callManager.acceptCall(socket,msg.id);
    callback(response);
  });

  socket.on("leaveCall", function(msg){
    callManager.leaveCall(socket.id, msg.id);
  });

  socket.on("joinREC", function(msg){
    callManager.playerJoinREC(msg.user, msg.channel);
  });

  socket.on("requestGameUpdate", () => {
    gameManager.sendGameUpdateToSocket(socket);
  });

  socket.on('disconnect', function(msg){
    gameManager.checkDisconnectingPlayer(gameManager.findPlayerBySocketId(socket.id));
    console.log(chalk.yellow("Disconnect"), chalk.white("A socket has disconnected"), socket.id, msg);
  });
}