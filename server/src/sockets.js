// @ts-check
import chalk from 'chalk';

/** @typedef {import("./ROCManager.js").default} ROCManager */
/** @typedef {import("socket.io").Socket} Socket */

/**
 * Game management socket handlers for the ROC system
 * Call-related handlers are now in callSockets.js
 * 
 * @param {Socket} socket 
 * @param {ROCManager} gameManager
 */
export function rocSockets (socket, gameManager) {  
  socket.on('newPlayer', async function (msg) {
    console.info(chalk.yellow("Event newPlayer", "New Player has joined the WebUI"));
    try {
      await gameManager.registerUser(socket, msg.discordId, 'player');
    } catch (error) {
      console.error(chalk.red('ROC'), 'Failed to register player:', error);
    }
  });

  socket.on('playerQuit', function(){
    gameManager.deleteUser(gameManager.findUserBySocketId(socket.id));
  });

  socket.on('moveToLobby', function(){
    gameManager.moveUserToLobby(socket.id);
  });

  socket.on('markAFK', function(){
    gameManager.markUserAFK(socket.id);
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

  socket.on("requestGameUpdate", () => {
    gameManager.sendGameUpdateToSocket(socket);
  });

  socket.on('disconnect', function(msg){
    gameManager.checkDisconnectingUser(gameManager.findUserBySocketId(socket.id));
    console.log(chalk.yellow("Disconnect"), chalk.white("A socket has disconnected"), socket.id, msg);
  });
}
