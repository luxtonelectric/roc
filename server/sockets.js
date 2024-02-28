// Begin Better logger
const chalk = require('chalk');
require('better-logging')(console, {
  format: ctx => `${ctx.date}${ctx.time24}${ctx.type}${ctx.STAMP('ROCManager.js', chalk.blueBright)} ${ctx.msg}`
});
// End Better Logger



const Player = require("./player");


module.exports = function (socket, gameManager) {  
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
  socket.on('movePlayerSim', function(msg){
    gameManager.movePlayerToSim(msg.user, msg.sim);
  });

  // Working
  socket.on("placeCall", function(msg){
    gameManager.placeCall(msg);
  });

  // Not Working
  socket.on("rejectCall", function(msg){
    gameManager.rejectCall(msg);
  });
  
  // Working
  socket.on("acceptCall", function(msg){
    gameManager.acceptCall(msg);
  });

  // Working
  socket.on("leaveCall", function(msg){
    gameManager.leaveCall(msg);
  });

  // Working
  socket.on("joinREC", function(msg){
    gameManager.playerJoinREC(msg.user);
  });

  // Working
  socket.on("startREC", function(msg){
    gameManager.playerStartREC(msg);
  });

  // Working
  socket.on('disconnect', function(msg){
    gameManager.deletePlayer(socket.id);
    console.log(chalk.yellow("Disconnect"), chalk.white("A socket has disconnected"), socket.id);
  });
}