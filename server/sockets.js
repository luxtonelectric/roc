// @ts-check
import chalk from 'chalk';

import Player from './model/player.js';
import ROCManager from './ROCManager.js';
import { Socket } from 'socket.io';
import CallManager from './callManager.js';

/**
 * 
 * @param {Socket} socket 
 * @param {ROCManager} gameManager
 * @param {CallManager} callManager 
 */
export function rocSockets (socket, gameManager, callManager) {  
  // Working
  socket.on('newPlayer', function (msg) {
    console.info(chalk.yellow("Event newPlayer", "New Player has joined the WebUI"));
    gameManager.registerWebUI(socket, msg.discordId);
  });

  // Working
  socket.on('playerQuit', function(msg){
    gameManager.deletePlayer(socket.id);
  });

  // Working
  socket.on('moveToLobby', function(msg){
    gameManager.movePlayerToLobby(socket.id);
  });

      // Working
  socket.on('markAFK', function(msg){
    gameManager.markPlayerAFK(socket.id);
  });

  // Working
  socket.on('updatePlayerPanel', function(msg){
    gameManager.updatePlayerPanel(msg.user, msg.panel)
  });

  // Working
  socket.on('claimPanel', function(msg){
    gameManager.claimPanel(msg.sender, msg.sim, msg.panel)
  });

  // Working
  socket.on('releasePanel', function(msg){
    gameManager.releasePanel(msg.sender, msg.sim, msg.panel)
  });

  // Working
  socket.on('movePlayerVoiceChannel', function(msg){
    gameManager.movePlayerToVoiceChannel(msg.user, msg.channel);
  });

  // Working
  socket.on("placeCall", function(msg,callback){
    const response = callManager.placeCall(socket.id, msg.type, msg.sender, msg.receiver);
    callback(response);
  });

  // Not Working
  socket.on("rejectCall", function(msg){
    callManager.rejectCall(socket.id,msg.id);
  });
  
  // Working
  socket.on("acceptCall", function(msg){
    callManager.acceptCall(socket,msg.id);
  });

  // Working
  socket.on("leaveCall", function(msg){
    callManager.leaveCall(socket.id, msg.id);
  });

  // Working
  socket.on("joinREC", function(msg){
    callManager.playerJoinREC(msg.user, msg.channel);
  });

  // Working
  socket.on('disconnect', function(msg){
    gameManager.checkDisconnectingPlayer(socket.id);
    console.log(chalk.yellow("Disconnect"), chalk.white("A socket has disconnected"), socket.id, msg);
  });
}