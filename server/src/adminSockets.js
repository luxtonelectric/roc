import chalk from 'chalk';
import fs from 'fs';
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
  socket.on("adminLogin", async function (msg, callback) {
    if (config.superUsers.some(u => u === msg.discordId)) {
      gameManager.addAdminUser(msg, socket);
      if (callback) {
        try {
          // Get initial voice channels
          const voiceChannels = await gameManager.getAvailableVoiceChannels();
          console.log(chalk.yellow('adminLogin'), chalk.green('Voice channels:'), voiceChannels?.length || 0);
          
          callback({
            success: true,
            voiceChannels
          });
        } catch (error) {
          console.error(chalk.red('Error in admin login:'), error);
          callback({ success: false, error: error.message });
        }
      }
    } else {
      console.info(chalk.redBright("ACCESS DENIED. User is not Admin."));
      if (callback) {
        callback({ success: false, error: 'Access denied' });
      }
    }
  });

  socket.on("getAvailableVoiceChannels", async function (msg, callback) {
    try {
      const voiceChannels = await gameManager.getAvailableVoiceChannels();
      console.log(chalk.yellow('getAvailableVoiceChannels'), chalk.green('Channels:'), voiceChannels?.length || 0);
      callback({
        success: true,
        voiceChannels
      });
    } catch (error) {
      console.error(chalk.red('Error getting voice channels:'), error);
      callback({ success: false, error: error.message });
    }
  });

  socket.on("getAvailableSimulations", async function(msg, callback) {
    try {
      callback({
        success: true,
        simulations: await gameManager.getAvailableSimulations(),
        voiceChannels: await gameManager.getAvailableVoiceChannels()
      });
    } catch (error) {
      console.error(chalk.red('Error getting available simulations:'), error);
      callback({ success: false, error: error.message });
    }
  });

  socket.on("addHost", async function (msg, callback) {
    try {
      if (!config.superUsers.some(u => u === socket.discordId)) {
        throw new Error("Not authorized");
      }

      // Add and activate the new host
      await gameManager.addHost(msg);
      
      callback({ success: true });
    } catch (error) {
      console.error(chalk.red('Error adding host:'), error);
      callback({ success: false, error: error.message });
    }
  });

  socket.on("updateHost", async function (msg, callback) {
    try {
      if (!config.superUsers.some(u => u === socket.discordId)) {
        throw new Error("Not authorized");
      }

      const { originalSimId, ...hostConfig } = msg;
      await gameManager.updateHost(originalSimId, hostConfig);
      callback({ success: true });
    } catch (error) {
      console.error(chalk.red('Error updating host:'), error);
      callback({ success: false, error: error.message });
    }
  });

  socket.on("deleteHost", async function (msg, callback) {
    try {
      if (!config.superUsers.some(u => u === socket.discordId)) {
        throw new Error("Not authorized");
      }

      await gameManager.deleteHost(msg.simId);
      callback({ success: true });
    } catch (error) {
      console.error(chalk.red('Error deleting host:'), error);
      callback({ success: false, error: error.message });
    }
  });

  socket.on("createPhone", function (msg) {
    console.log(chalk.yellow('createPhone'), msg)
    try {
      phoneManager.generatePhoneForPerson(msg.number, msg.name, msg.type, msg.location, msg.hidden)
      gameManager.sendGameUpdateToPlayers();
    } catch (error) {
      console.log(chalk.red('ERROR creating phone.'));
    }
  });

  socket.on('claimPhone', function (msg) {
    console.log('adminSockets claimPhone', msg.phoneId)
    const phone = phoneManager.getPhone(msg.phoneId);
    const player = gameManager.findPlayerBySocketId(socket.id);
    if(phone && player) {
      console.log(phone.toAdminView(), player.toSimple());
      phoneManager.assignPhone(phone,player);
      gameManager.sendGameUpdateToPlayers();
      gameManager.updateAdminUI();
    } else {
      console.log('ADMIN SOCKET claimPhone error');
    }
  })

  socket.on("enableInterfaceGateway", function (msg, callback) {
    console.log(chalk.yellow('enableInterfaceGateway'), msg)
    try {
      if (!config.superUsers.some(u => u === socket.discordId)) {
        throw new Error("Not authorized");
      }
      
      gameManager.enableInterfaceGateway(msg.simId);
      callback?.({ success: true });
    } catch (error) {
      console.error(chalk.red('Error enabling Interface Gateway:'), error);
      callback?.({ success: false, error: error.message });
      // Make sure the UI is updated to reflect the actual state
      gameManager.updateAdminUI();
    }
  });
  socket.on("disableInterfaceGateway", function (msg, callback) {
    console.log(chalk.yellow('disableInterfaceGateway'), msg)
    try {
      if (!config.superUsers.some(u => u === socket.discordId)) {
        throw new Error("Not authorized");
      }
      
      gameManager.disableInterfaceGateway(msg.simId);
      callback?.({ success: true });
    } catch (error) {
      console.error(chalk.red('Error disabling Interface Gateway:'), error);
      callback?.({ success: false, error: error.message });
      // Make sure the UI is updated to reflect the actual state
      gameManager.updateAdminUI();
    }
  });

  socket.on("enableConnections", function (msg) {
    console.log(chalk.yellow('enableConnections'), msg)
    gameManager.enableConnections(msg.simId);
  });
  socket.on("disableConnections", function (msg) {
    console.log(chalk.yellow('disableConnections'), msg)
    gameManager.disableConnections(msg.simId);
  });

  socket.on("enableHost", async function (msg) {
    if (!config.superUsers.some(u => u === socket.discordId)) {
      return;
    }
    console.log(chalk.yellow('enableHost'), msg)
    await gameManager.enableHost(msg.simId);
  });

  socket.on("disableHost", async function (msg) {
    if (!config.superUsers.some(u => u === socket.discordId)) {
      return;
    }
    console.log(chalk.yellow('disableHost'), msg)
    await gameManager.disableHost(msg.simId);
  });

  // kick the user from the call handler thingey socket yum
  socket.on("adminKickFromCall", function (msg) {
    gameManager.kickUserFromCall(msg);
  });
}