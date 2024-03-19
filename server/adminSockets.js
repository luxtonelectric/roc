import chalk from 'chalk';

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