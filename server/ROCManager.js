// @ts-check
import chalk from 'chalk'
import Player from './model/player.js';
import { readFile } from "fs/promises";
import Simulation from './model/simulation.js';
/** @typedef {import("./bot.js").default} DiscordBot */
/** @typedef {import("./phonemanager.js").default} PhoneManager */
/** @typedef {import("socket.io").Server} Server */
/** @typedef {import("socket.io").Socket} Socket */
/** @typedef {import("./stomp.js").default} STOMPManager */

export default class ROCManager {
  prospects = {};
  players = {};
  admins = {};
  /** @type {Simulation[]} */
  sims = [];

  /**
   * 
   * @param {Server} io 
   * @param {DiscordBot} bot 
   * @param {PhoneManager} phoneManager
   * @param {STOMPManager} stompManager 
   */
  constructor(io, bot, phoneManager, stompManager) {
    this.io = io;
    this.bot = bot;
    this.phoneManager = phoneManager;
    this.stompManager = stompManager;
    console.info(chalk.yellow("constructor"), `Welcome! Yum yum!`);
  }

  /**
   * 
   * @param {*} config 
   */
  load(config) {
    this.channels = config.channels;
    this.config = config;
    this.stompManager.setGameManager(this);
    this.bot.setGameManager(this);

    config.games.forEach(g => {this.activateGame(g)},this) 
  }

  /**
   * 
   * @param {string} simId 
   * @returns {Promise<Simulation>}
   */
  async getSimData(simId) {
    /** @type {Simulation[]} */
    const simConfig = JSON.parse( await readFile('./simulations.json', 'utf8'));
    return Simulation.fromSimData(simConfig.find(s => s.id == simId));
  }

  activateGame(game) {
    this.stompManager.createClientForGame(game);
    this.getSimData(game.sim).then(sim =>{
      if(sim) {
        console.log('LOADING PHONES FOR SIM', game.sim);
        this.phoneManager.generatePhonesForSim(sim);
        this.sims.push(sim);
      } else {
        console.error('Unable to find simulation for', game.sim);
      }
    });

  }

  // ============================ BEGIN PLAYER CODE ============================

  /**
   * 
   * @param {Socket} socket 
   * @param {string} discordId 
   */
  async registerWebUI(socket, discordId) {
    console.log(chalk.yellow("registerWebUI"), discordId);
    if (typeof this.prospects[discordId] === 'undefined') {
      // This is an unknown prospect are they a player already?
      if (typeof this.players[discordId] === 'undefined') {
        // They're totally new.
        const p = new Player(socket, discordId, null);

        const vc = await this.bot.getUserVoiceChannel(discordId);
        if (vc === null) {
          console.log(chalk.yellow("registerWebUI"), discordId, "has no VC yet...");
          this.prospects[discordId] = p;
          socket.emit("loggedIn", {
            "loggedIn": false,
            "error": "You aren't in a voice chat.."
          });
        } else {
          console.log(chalk.yellow("registerWebUI"), discordId, "adding player...");
          p.voiceChannelId = vc;
          this.addPlayer(p);
        }
      } else {
        // They're already a player...
        console.log(chalk.yellow("registerWebUI"), discordId, "is already a player");
        this.players[discordId].socket = socket;
        socket.join(discordId);
        //@ts-expect-error
        socket.discordId = discordId;
        socket.emit("loggedIn", {
          "loggedIn": true,
          "error": ""
        });
        this.sendGameUpdateToPlayer(this.players[discordId]);
        this.updatePlayerInfo(this.players[discordId]);
      }
    } else {
      // They're a prospect already...
      console.log(chalk.yellow("registerWebUI"), discordId, "is already a prospect");
      if (this.prospects[discordId].voiceChannelId !== null) {
        // They're in a VC and we now have a socket, process the new player
        this.prospects[discordId].socket = socket;
        this.addPlayer(this.prospects[discordId]);
      } else {
        console.log(chalk.yellow("registerWebUI"), discordId, this.prospects[discordId].voiceChannelId);
        // They're refreshing? Update the socket and await both connections...
        this.prospects[discordId].socket = socket;

        socket.emit("loggedIn", {
          "loggedIn": false,
          "error": "You aren't in a voice chat.."
        });
      }
    }
  }

  registerDiscordVoice(discordId, voiceChannelId) {
    if (typeof this.prospects[discordId] === 'undefined') {
      // They're not a prospect... are they already a player?
      if (typeof this.players[discordId] === 'undefined') {
        // Not a prospect, not a player...
        const p = new Player(null, discordId, voiceChannelId);
        this.prospects[discordId] = p;
      } else {
        // They're already a player...
        this.io.to(discordId).emit("loggedIn", {
          "loggedIn": true,
          "error": ""
        });
        this.sendGameUpdateToPlayer(this.players[discordId]);
        this.updatePlayerInfo(this.players[discordId]);
      }
    } else {
      // They're a prospect already...
      if (this.prospects[discordId].socket !== null && this.prospects[discordId].voiceChannelId === null) {
        this.prospects[discordId].voiceChannelId = voiceChannelId;
        this.addPlayer(this.prospects[discordId]);
      }
    }
  }

  unregisterDiscordVoice(discordId) {
    if (discordId in this.players) {
      this.players[discordId].voiceChannelId = null;
      if (this.players[discordId].socket !== null) {
        this.io.to(discordId).emit("loggedIn", {
          "loggedIn": false,
          "error": "You aren't in a voice chat.."
        });
      }
    }
  }



  //takes player object
  async addPlayer(newPlayer) {
    console.info(chalk.yellow("AddPlayer"), "New Player Joining");
    if (typeof newPlayer.discordId !== 'undefined' && newPlayer.discordId.length > 2) {
      var channel = await this.bot.getUserVoiceChannel(newPlayer.discordId);
      if (channel) {
        console.info(chalk.yellow("AddPlayer"), `User ${newPlayer.discordId} is in a voice channel:`, chalk.magentaBright(channel));

        if (this.players[newPlayer.discordId] !== undefined) {
          // This player has already logged in!
          const existingPlayer = this.players[newPlayer.discordId];

          if (existingPlayer.isConnected === false) {
            console.info(chalk.yellow("AddPlayer"), `User ${newPlayer.discordId} is reconnecting after socket disconnect`);
            // They DCd and we caught it just let them back in
            if (existingPlayer.voiceChannelId === channel) {
              //They're still in the same place they were before. Everything is good with the world
            } else {
              //They're somehow changed rooms... guess we should update
              existingPlayer.voiceChannelId = channel;
            }

            existingPlayer.socket = newPlayer.socket;
            existingPlayer.socket.join(existingPlayer.discordId);
            existingPlayer.socket.discordId = existingPlayer.discordId;
            existingPlayer.isConnected = true;
            existingPlayer.socket.emit("loggedIn", {
              "loggedIn": true,
              "error": ""
            });
            this.sendGameUpdateToPlayers();
            this.updatePlayerInfo(existingPlayer);
            return true;
          } else {
            // They're connecting twice for the same person?! This is sus. Follow normal login.
          }

        } else {
          // Brand new Player
          //console.log("Brand New Player!");
        }

        this.players[newPlayer.discordId] = newPlayer;
        newPlayer.socket.join(newPlayer.discordId);
        newPlayer.socket.discordId = newPlayer.discordId;
        newPlayer.socket.emit("loggedIn", {
          "loggedIn": true,
          "error": ""
        });
        this.sendGameUpdateToPlayers();
        this.updatePlayerInfo(newPlayer);

      } else {
        console.info(chalk.yellow("AddPlayer"), `User ${newPlayer.discordId} is not in a voice channel:`);
        newPlayer.socket.emit("loggedIn", {
          "loggedIn": false,
          "error": "You aren't in a voice chat.."
        });
        return false;
      }
    } else {
      console.info(chalk.yellow("AddPlayer"), `User ${newPlayer.discordId} is not a discord username. What?`);
      newPlayer.socket.emit("loggedIn", {
        "loggedIn": false,
        "error": "That isn't a discord username."
      });
    }
  }

  updatePlayerPanel(user, panel) {
    this.players[user].panel = panel;
    this.sendGameUpdateToPlayers();
  }

  findPlayerBySocketId(socketId) {
    for (var [key, value] of Object.entries(this.players)) {
      if (value.socket.id === socketId) {
        return this.players[key];
      }
    }
    return null;
  }

  checkDisconnectingPlayer(socketId) {
    const player = this.findPlayerBySocketId(socketId);
    if (player === null) {
      return false;
    }

    const playerChannel = this.bot.getUserVoiceChannel(player.discordId);
    if (playerChannel === null) {
      //The player is not in voice then assume they've left and delete them.
      this.deletePlayer(socketId);
    } else {
      console.log(chalk.yellow("checkDisconnectingPlayer"), player.discordId, chalk.white("has lost connection but is still in voice. Maintaining game state."));
      //The player is still in voice then assume they're coming back and don't delete them but mark them away
      player.isConnected = false;
      this.sendGameUpdateToPlayers();
    }


  }

  //Takes in a SocketId
  deletePlayer(socketId) {
    console.log("Player wishes to leave:", socketId);
    // Delete the player from the players list...
    for (var [key, value] of Object.entries(this.players)) {
      if (value.socket.id === socketId) {
        console.log(chalk.yellow("Delete Player"), key, chalk.white("was deleted from the game"));
        delete this.players[key];
        // Unclaim any claimed panels
        for (var skey of Object.keys(this.sims)) {
          if (typeof this.sims[skey].panels !== "undefined") {
            for (var pkey of Object.keys(this.sims[skey].panels)) {
              if (this.sims[skey].panels[pkey].player === key) {
                console.log(chalk.yellow("Delete Player"), key, chalk.white("was removed as controlling panel"), pkey);
                this.sims[skey].panels[pkey].player = undefined;
              }
            }
          }
        }
      }
    }
    this.sendGameUpdateToPlayers();
  }

  claimPanel(user, requestedSim, requestedPanel) {
    const player = this.players[user];
    if (typeof player === "undefined") {
      console.error(chalk.red("Claim panel called with undefined player"), user, requestedSim, requestedPanel);
      return false;
    }

    const sim = this.sims.find(s => s.id === requestedSim);
    if (typeof sim === "undefined") {
      console.error(chalk.red("Claim panel called with undefined sim"), user, requestedSim, requestedPanel);
      return false;
    }

    const panel = sim.panels.find(p => p.id === requestedPanel);
    if (typeof panel === "undefined") {
      console.error(chalk.red("Claim panel called with undefined panel"), user, requestedSim, requestedPanel);
      return false;
    }
    //Assign the player to the panel
    panel.player = user;
    this.phoneManager.assignPhone(panel.id, player.discordId)
    //Update the panel's phone to be assigned to the player
    this.updatePlayerInfo(player);
    this.sendGameUpdateToPlayers();
    console.log(chalk.yellow('ClaimPanel'), user, 'claimed', requestedSim, requestedPanel);
  }

  releasePanel(user, requestedSim, requestedPanel) {
    const player = this.players[user];
    if (typeof player === "undefined") {
      console.error(chalk.red("Release panel called with undefined player"), user, requestedSim, requestedPanel);
      return false;
    }

    const sim = this.sims.find(s => s.id === requestedSim);
    if (typeof sim === "undefined") {
      console.error(chalk.red("Release panel called with undefined sim"), user, requestedSim, requestedPanel);
      return false;
    }

    const panel = sim.panels.find(p => p.id === requestedPanel);
    if (typeof panel === "undefined") {
      console.error(chalk.red("Release panel called with undefined panel"), user, requestedSim, requestedPanel);
      return false;
    }
    //Assign the player to the panel
    panel.player = undefined;
    this.phoneManager.unassignPhone(panel.id);
    //Update the panel's phone to be assigned to the player
    this.updatePlayerInfo(player);
    this.sendGameUpdateToPlayers();
    console.log(chalk.yellow('ReleasePanel'), user, 'released', requestedSim, requestedPanel);
  }


  // ============================== END PLAYER CODE ==============================

  async movePlayerToVoiceChannel(playerId, channelId) {
    console.log(chalk.blueBright("GameManager"), chalk.yellow("movePlayerToVoiceChannel"), playerId, channelId);
    this.players[playerId].voiceChannelId = channelId;
    await this.bot.setUserVoiceChannel(playerId, channelId);
  }

  async movePlayerToLobby(socketId) {
    const player = this.findPlayerBySocketId(socketId);
    const channelId = this.channels.lobby;
    await this.bot.setUserVoiceChannel(player.discordId, channelId);
  }

  async markPlayerAFK(socketId) {
    const player = this.findPlayerBySocketId(socketId);
    if (player === null) {
      console.log(chalk.red("markPlayerAFK Invalid player at socket", socketId));
      return false;
    }
    const channelId = this.channels.afk;
    if (channelId === null || typeof channelId === 'undefined') {
      console.log(chalk.red("markPlayerAFK Invalid player at socket", socketId));
      return false;
    }
    await this.bot.setUserVoiceChannel(player.discordId, channelId);
  }


  getGameState() {
    console.log(this.sims);
    return this.sims.filter(s => s.enabled);
  }

  // Just updates the player UI for all players
  sendGameUpdateToPlayers() {
    this.io.emit("gameInfo", this.getGameState());
    this.updateAdminUI();
  }

  sendGameUpdateToPlayer(player) {
    player.socket.emit("gameInfo", this.getGameState());
  }
  /**
   * 
   * @param {Player} player 
   */
  updatePlayerInfo(player) {
    const phones = this.phoneManager.getPhonesForDiscordId(player.discordId);
    const pm = this.phoneManager;
    phones.forEach(p => { p.speedDial = pm.getSpeedDialForPhone(p); p.trainsAndMobiles = pm.getTrainsAndMobilesForPhone(p) });
    const myPanels = [];
    this.sims.forEach(s => myPanels.concat(s.panels.filter(p => p.player === player.discordId)))
    const info = {};
    info.phones = phones;
    info.panels = myPanels;
    player.socket.emit("playerInfo", info);
    //console.log(chalk.yellow("updatePlayerInfo"), info);
  }

  // ================================================= ADMIN STUFF ================================================= 

  addAdminUser(data, socket) {
    this.admins[socket.id] = socket;
    socket.join('admins');
    socket.emit('authd', { "success": true });
    this.updateAdminUI();
  }


  updateAdminUI() {
    this.io.to('admins').emit('adminStatus', this.adminGameStatus());
  }
  adminGameStatus() {

    return {
      gameState: this.getGameState()
    }
  }


  updateSimTime(clockMsg) {
    if (clockMsg["area_id"] in this.sims) {
      const sim = this.sims[clockMsg["area_id"]];
      delete clockMsg.area_id;
      sim.clock = clockMsg;
      this.sendGameUpdateToPlayers();
    }
  }

  // ============================= ADMIN STUFF =================================== 
}

function getKeyByValue(object, value) {
  return Object.keys(object).find(key => object[key] === value);
}