// Begin Better logger
const chalk = require('chalk');
require('better-logging')(console, {
  format: ctx => `${ctx.date}${ctx.time24}${ctx.type}${ctx.STAMP('ROCManager.js', chalk.blueBright)} ${ctx.msg}`
});
// End Better Logger

const config = 

module.exports = function (socket, gameManager, config) {  
  socket.on("adminLogin", function(msg){
    console.info(msg);
    if(msg.password === config.adminPassword)
    {
      console.info("Admin user works");
      gameManager.addAdminUser(msg, socket);
    }
    else
    {
      console.info(chalk.redBright("The lamb sauce was not obtained."));
    }
  });

  // kick the user from the call handler thingey socket yum
  socket.on("adminKickFromCall", function(msg){
    gameManager.kickUserFromCall(msg);
  });
}