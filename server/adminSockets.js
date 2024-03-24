import chalk from 'chalk';
/** @typedef {import("./ROCManager.js").default} ROCManager */
/** @typedef {import("./phonemanager.js").default} PhoneManager */
/** @typedef {import("socket.io").Socket} Socket */

/**
 * 
 * @param {Socket} socket 
 * @param {ROCManager} gameManager 
 * @param {PhoneManager} phoneManager 
 * @param {*} config 
 */
export function adminSockets(socket, gameManager, phoneManager, config) {  
  socket.on("adminLogin", function(msg){
    if(config.superUsers.some(u => u === msg.discordId))
    {
      gameManager.addAdminUser(msg, socket);
    }
    else
    {
      console.info(chalk.redBright("ACCESS DENIED. User is not Admin."));
    }
  });

  socket.on("createPhone", function(msg){
    console.log(chalk.yellow('createPhone'), msg)
    if(phoneManager.generatePhoneForPerson(msg.number, msg.name, msg.type, msg.location, msg.hidden))
    {
      gameManager.sendGameUpdateToPlayers();
    }
  });

  socket.on("enableInterfaceGateway", function(msg){
    console.log(chalk.yellow('enableInterfaceGateway'), msg)
    gameManager.enableInterfaceGateway(msg.simId);
  });
  socket.on("disableInterfaceGateway", function(msg){
    console.log(chalk.yellow('disableInterfaceGateway'), msg)
    gameManager.disableInterfaceGateway(msg.simId);
  });

  // kick the user from the call handler thingey socket yum
  socket.on("adminKickFromCall", function(msg){
    gameManager.kickUserFromCall(msg);
  });
}