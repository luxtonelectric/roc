import chalk from 'chalk';
import betterLogging from 'better-logging';
betterLogging(console,{
  format: ctx => `${ctx.date}${ctx.time24}${ctx.type}${ctx.STAMP('sockets.js', chalk.blueBright)} ${ctx.msg}`
});

import Player from './player.js';

export function rocSockets (socket, gameManager) {  
  // Working
  socket.on('newPlayer', function (msg) {
    console.info(chalk.yellow("Event newPlayer", "New Player has joined"));
    let p = new Player(msg.panel, socket, msg.discordID);
    gameManager.addPlayer(p);
  });

  // Working
  socket.on('playerQuit', function(msg){
    gameManager.deletePlayer(socket.id);
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
  socket.on('movePlayerSim', function(msg){
    gameManager.movePlayerToSim(msg.user, msg.sim);
  });

  // Working
  socket.on("placeCall", function(msg){
    gameManager.placeCall(socket.id, msg.receiver,msg.sender);
  });

  // Not Working
  socket.on("rejectCall", function(msg){
    gameManager.rejectCall(socket.id,msg.senderPhoneId,msg.receiverPhoneId);
  });
  
  // Working
  socket.on("acceptCall", function(msg){
    gameManager.acceptCall(socket.id,msg.sender, msg.receiver);
  });

  // Working
  socket.on("leaveCall", function(msg){
    gameManager.leaveCall(msg);
  });

  // Working
  socket.on("joinREC", function(msg){
    gameManager.playerJoinREC(msg.user, msg.channel);
  });

  // Working
  socket.on("startREC", function(msg){
    gameManager.playerStartREC(msg.user,msg.panel);
  });

  // Working
  socket.on('disconnect', function(msg){
    gameManager.checkDisconnectingPlayer(socket.id);
    console.log(chalk.yellow("Disconnect"), chalk.white("A socket has disconnected"), socket.id);
  });
}