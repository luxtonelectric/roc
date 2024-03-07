import chalk from 'chalk';
import betterLogging from 'better-logging';
betterLogging(console,{
  format: ctx => `${ctx.date}${ctx.time24}${ctx.type}${ctx.STAMP('adminSockets.js', chalk.blueBright)} ${ctx.msg}`
});

export function adminSockets(socket, gameManager, config) {  
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