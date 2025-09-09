// @ts-check
import chalk from 'chalk'
import Player from './model/player.js';
import Simulation from './model/simulation.js';
import ClockData from './model/clockData.js';
import Host, { InterfaceGateway } from './model/host.js';
import SimulationLoader from './services/SimulationLoader.js';
import ConfigurationManager from './services/ConfigurationManager.js';
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
  /** @type {Host[]} */
  hosts = [];
  config = null;
  channels = null;
  io = null;
  bot = null;
  phoneManager = null;
  stompManager = null;
  /** @type {SimulationLoader} */
  simulationLoader = null;
  /** @type {ConfigurationManager} */
  configurationManager = null;

  /**
   * @param {Server} io 
   * @param {DiscordBot} bot 
   * @param {PhoneManager} phoneManager
   * @param {STOMPManager} stompManager 
   * @param {SimulationLoader} simulationLoader
   * @param {ConfigurationManager} configurationManager
   */
  constructor(io, bot, phoneManager, stompManager, simulationLoader, configurationManager) {
    this.io = io;
    this.bot = bot;
    this.phoneManager = phoneManager;
    this.stompManager = stompManager;
    this.simulationLoader = simulationLoader;
    this.configurationManager = configurationManager;
    console.info(chalk.yellow("constructor"), `Welcome! Yum yum!`);
  }

  /**
   * Load configuration and initialize the game manager
   */
  load() {
    const config = this.configurationManager.getCachedConfig();
    if (!config) {
      throw new Error('Configuration not loaded. Ensure ConfigurationManager.loadConfig() is called first.');
    }
    
    this.channels = config.channels;
    this.config = config;
    this.stompManager.setGameManager(this);
    this.bot.setGameManager(this);
    
    // Convert config games to Host instances and reset IG enabled state
    this.hosts = config.games.map(gameConfig => {
      const host = Host.fromConfig(gameConfig);
      // Always start with IG disabled on server restart
      host.interfaceGateway.enabled = false;
      host.interfaceGateway.connectionState = 'disconnected';
      host.interfaceGateway.errorMessage = undefined;
      return host;
    });
    
    // Only activate enabled games
    this.hosts.filter(host => host.enabled).forEach(host => { this.activateGame(host) }, this);
  }

  /**
   * Get simulation data, optionally loading from disk if not cached
   * @param {string} simId 
   * @param {boolean} loadIfNotExists Whether to load from disk if not in memory
   * @returns {Simulation|undefined}
   */
  getSimData(simId, loadIfNotExists = false) {
    // First check if we already have this sim loaded
    const existingSim = this.sims.find(s => s.id === simId);
    if (existingSim || !loadIfNotExists) {
      return existingSim;
    }

    // Only load from disk if explicitly requested
    return this.simulationLoader.loadSimulation(simId);
  }

  /**
   * Gets basic simulation metadata without loading the full simulation
   * @param {string} simId 
   * @returns {{id: string, name: string}|null}
   */
  getSimMetadata(simId) {
    return this.simulationLoader.getSimulationMetadata(simId);
  }

  /**
   * Get list of available simulations and their metadata
   * @returns {Promise<{id: string, name: string}[]>}
   */
  async getAvailableSimulations() {
    return this.simulationLoader.getAvailableSimulations();
  }

  /**
   * Update an existing host configuration
   * @param {string} originalSimId The original simulation ID
   * @param {object} hostConfig The new host configuration
   */
  async updateHost(originalSimId, hostConfig) {
    const existingHost = this.getHostById(originalSimId);
    if (!existingHost) {
      throw new Error("Host not found");
    }

    // Save old connection state
    const wasEnabled = existingHost.interfaceGateway.enabled;
    
    // If sim ID hasn't changed, we need to preserve phones
    const preservePhones = hostConfig.sim === originalSimId;
    
    // Deactivate the old simulation, preserving state if not changing sims
    const preservedState = await this.deactivateGame(originalSimId, preservePhones, hostConfig.sim === originalSimId);
    
    // Remove existing host from hosts array
    this.hosts = this.hosts.filter(host => host.sim !== originalSimId);
    
    // Create new host instance, preserving IG state
    const newHost = Host.fromConfig(hostConfig);
    newHost.interfaceGateway.enabled = wasEnabled;
    this.hosts.push(newHost);

    // Sync with config and save
    this.syncHostsWithConfig();
    await this.saveConfig(this.config);
    
    // Reactivate if needed
    if (hostConfig.sim === originalSimId && preservedState) {
      await this.activateGame(newHost, preservedState);
    } else if (wasEnabled) {
      await this.activateGame(newHost);
    }
    
    this.sendGameUpdateToPlayers();
  }

  /**
   * Delete a host and clean up its resources
   * @param {string} simId The simulation ID to delete
   */
  async deleteHost(simId) {
    const existingHost = this.getHostById(simId);
    if (!existingHost) {
      throw new Error("Host not found");
    }

    // Clean up simulation and all its resources
    await this.deactivateGame(simId);

    // Remove from hosts array and sync with config
    this.hosts = this.hosts.filter(host => host.sim !== simId);
    this.syncHostsWithConfig();
    await this.saveConfig(this.config);
    
    this.sendGameUpdateToPlayers();
  }

  /**
   * @param {string} simId
   */
  getSimById(simId) {
    return this.sims.find(sim => sim.id === simId);
  }

  /**
   * Get host by simulation ID
   * @param {string} simId
   * @returns {Host|undefined}
   */
  getHostById(simId) {
    return this.hosts.find(host => host.sim === simId);
  }

  /**
   * Update hosts array and sync with config
   */
  syncHostsWithConfig() {
    this.config.games = this.hosts.map(host => host.toConfig());
  }

  /**
   * @param {Host|*} host The host instance or game configuration to activate
   * @param {object|null} preservedState Optional preserved state to restore
   */
  activateGame(host, preservedState = null) {
    console.log(chalk.yellow('activateGame'), 'Activating game for', host.sim);
    // Convert to Host instance if needed
    const hostInstance = host instanceof Host ? host : Host.fromConfig(host);
    
    // Check if sim is already loaded
    const existingSim = this.sims.find(s => s.id === hostInstance.sim);
    if (existingSim) {
      // If sim already exists, just update the stomp client without recreating phones
      this.stompManager.createClientForHost(hostInstance);
      return;
    }

    // Load the simulation data since this is an enabled host
    this.stompManager.createClientForHost(hostInstance);
    const sim = this.getSimData(hostInstance.sim, true) // true to load if not exists
    if (sim) {
      //console.log(chalk.yellow('activateGame'), chalk.green('Loading phones for sim:'), chalk.white(hostInstance.sim));
      
      // Generate phones for all panels in this sim (including neighbor phones)
      sim.panels = this.phoneManager.generatePhonesForSim(sim);

      // If we have preserved state, restore it
      if (preservedState) {
        console.log(chalk.yellow('activateGame'), chalk.green('Restoring preserved state for sim:'), chalk.white(hostInstance.sim));
        sim.panels = preservedState.panels;
        sim.time = preservedState.time;
        sim.connectionsOpen = preservedState.connectionsOpen;
      }

      sim.config = {
        channel: hostInstance.channel,
        host: hostInstance.host,
        port: hostInstance.port,
        interfaceGateway: hostInstance.interfaceGateway.toConfig(),
      };
      this.sims.push(sim);
    } else {
      console.error('Unable to find simulation for', hostInstance.sim);
    }
  }

  enableInterfaceGateway(simId) {
    try {
      // Find the host configuration
      const host = this.getHostById(simId);
      if (!host) {
        throw new Error("Host configuration not found");
      }
      if (!host.enabled) {
        throw new Error("Cannot enable Interface Gateway: Host is disabled");
      }

      // Enable the Interface Gateway on the host instance
      host.enableInterfaceGateway();
      
      // Activate the Interface Gateway client
      const result = this.stompManager.activateClientForGame(simId);
      
      // Sync with config and update UI
      this.syncHostsWithConfig();
      this.updateAdminUI();
      return result;
    } catch (error) {
      console.error(chalk.red("Failed to enable Interface Gateway:"), error);
      throw error;
    }
  }

  disableInterfaceGateway(simId) {
    try {
      // Find the host and disable Interface Gateway
      const host = this.getHostById(simId);
      if (host) {
        host.disableInterfaceGateway();
        this.syncHostsWithConfig();
      }
      
      // Remove client completely instead of just deactivating
      this.stompManager.removeClientForGame(simId);
      this.updateAdminUI();
    } catch (error) {
      console.error(chalk.red("Failed to disable Interface Gateway:"), error);
      throw error;
    }
  }

  /**
   * Update Interface Gateway connection state
   * @param {string} simId The simulation ID
   * @param {string} state Connection state ('connected', 'disconnected', 'connecting', 'error')
   * @param {string} errorMessage Optional error message
   */
  updateInterfaceGatewayState(simId, state, errorMessage = undefined) {
    const host = this.getHostById(simId);
    if (host) {
      host.updateInterfaceGatewayState(state, errorMessage);
      this.syncHostsWithConfig();
      this.updateAdminUI();
    }
  }

  /**
   * Notify admin clients that voice channels have changed
   */
  async notifyVoiceChannelUpdate() {
    const channels = await this.getAvailableVoiceChannels();
    this.io.to('admins').emit('voiceChannelsUpdate', channels);
  }

  async enableHost(simId) {
    const host = this.getHostById(simId);
    if (host) {
      host.enable();
      this.syncHostsWithConfig();
      await this.saveConfig(this.config);
      
      // Activate the game when enabled
      console.log(chalk.yellow('enableHost'), 'Activating game for', simId);
      await this.activateGame(host);
      
      this.updateAdminUI();
      this.sendGameUpdateToPlayers();
    }
  }

  async disableHost(simId) {
    const host = this.getHostById(simId);
    if (host) {
      // If IG is enabled, disable it first
      if (host.interfaceGateway.enabled) {
        this.disableInterfaceGateway(simId);
      }
      
      // Deactivate the simulation first
      await this.deactivateGame(simId);
      
      host.disable();
      this.syncHostsWithConfig();
      await this.saveConfig(this.config);
      
      this.updateAdminUI();
      this.sendGameUpdateToPlayers();
    }
  }

  enableConnections(simId) {
    this.getSimById(simId).connectionsOpen = true;
    this.updateAdminUI();
  }

  disableConnections(simId) {
    this.getSimById(simId).connectionsOpen = false;
    this.updateAdminUI();
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
            "error": "ROC_VC_DISCONNECTED"
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
          "error": "ROC_VC_DISCONNECTED"
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
      if (!this.players[discordId].socket.disconnected) {
        this.io.to(discordId).emit("loggedIn", {
          "loggedIn": false,
          "error": "ROC_VC_DISCONNECTED"
        });
      } else {
        this.checkDisconnectingPlayer(this.players[discordId])
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
            this.phoneManager.sendPhonebookUpdateToPlayer(existingPlayer.discordId);
            return true;
          } else {
            // They're connecting twice for the same person?! This is sus. Follow normal login.
          }
          
        } else {
          // Brand new Player
          //console.log("Brand New Player!");
        }
        const member = await this.bot.getMember(newPlayer.discordId);
        const avatarURL = member.displayAvatarURL();

        newPlayer.avatarURL = avatarURL;
        newPlayer.displayName = member.displayName;
        
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
          "error": "ROC_VC_DISCONNECTED"
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

  /**
   * 
   * @param {string} socketId 
   * @returns {Player}
   */
  findPlayerBySocketId(socketId) {
    for (var [key, value] of Object.entries(this.players)) {
      if (value.socket.id === socketId) {
        return this.players[key];
      }
    }
    return null;
  }

  isPlayer(discordId) {
    if(this.players[discordId]) {
      return true;
    }

    return false;
  }

  isProspect(discordId) {
    if(this.prospects[discordId]) {
      return true;
    }

    return false;
  }


  /**
   * 
   * @param {Player} player 
   * @returns 
   */
  checkDisconnectingPlayer(player) {
    if (!player) {
      return false;
    }

    this.bot.getUserVoiceChannel(player.discordId).then((playerChannel) => {
      if (playerChannel === null && player.socket.disconnected) {
        //The player is not in voice then assume they've left and delete them.
        this.deletePlayer(player);
      } else {
        console.log(chalk.yellow("checkDisconnectingPlayer"), player.discordId, chalk.white("has lost connection but is still in voice. Maintaining game state."));
        //The player is still in voice then assume they're coming back and don't delete them but mark them away
        player.isConnected = false;
        this.sendGameUpdateToPlayers();
      }
    }

    );


  }

  /**
   * 
   * @param {Player} player 
   */
  deletePlayer(player) {
    console.log("Player wishes to leave:", player.discordId);
    // Delete the player from the players list...

    this.phoneManager.unassignPhonesForDiscordId(player.discordId)

    // Unclaim any claimed panels
    for (var skey of Object.keys(this.sims)) {
      if (typeof this.sims[skey].panels !== "undefined") {
        for (var pkey of Object.keys(this.sims[skey].panels)) {
          if (this.sims[skey].panels[pkey].player === player.discordId) {
            console.log(chalk.yellow("Delete Player"), player.discordId, chalk.white("was removed as controlling panel"), pkey);
            this.sims[skey].panels[pkey].player = undefined;
          }
        }
      }
    }
    delete this.players[player.discordId];

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
    //Assign the player and their details to the panel
    panel.player = user;
    panel.playerDetails = {
      id: player.discordId,
      displayName: player.displayName,
      avatarURL: player.avatarURL
    };
    this.phoneManager.assignPhone(panel.phone, player)
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
    panel.player = undefined;
    panel.playerDetails = undefined;
    this.phoneManager.unassignPhone(panel.phone);
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
    return this.sims.filter(s => s.enabled);
  }

  getHostState() {
    return this.hosts.map(host => host.toClientObject());
  }

  // Just updates the player UI for all players
  sendGameUpdateToPlayers() {
    console.log('sendingGameUpdate');
    this.io.emit("gameInfo", this.getGameState());
    this.updateAdminUI();
  }

  sendGameUpdateToSocket(socket) {
    socket.emit("gameInfo", this.getGameState());
  }

  sendGameUpdateToPlayer(player) {
    this.sendGameUpdateToSocket(player.socket);
  }
  /**
   * 
   * @param {Player} player 
   */
  updatePlayerInfo(player) {
    const phones = this.phoneManager.getPhonesForDiscordId(player.discordId);
    const pm = this.phoneManager;
    phones.forEach(p => { p.setSpeedDial(pm.getSpeedDialForPhone(p)); p.setTrainsAndMobiles(pm.getTrainsAndMobilesForPhone(p)) });
    const myPanels = [];
    this.sims.forEach(s => myPanels.concat(s.panels.filter(p => p.player === player.discordId)))
    const info = {};
    info.phones = phones.map(p => p.getPhoneBook());
    info.panels = myPanels;
    player.socket.emit("playerInfo", info);
    //console.log(chalk.yellow("updatePlayerInfo"), info);
  }

  // ================================================= ADMIN STUFF ================================================= 

  async addAdminUser(data, socket) {
    console.info(chalk.yellow('Adding Admin User'), data);
    this.admins[socket.id] = socket;

    if(!this.isPlayer(data.discordId)) {
      this.players[data.discordId] = new Player(socket,data.discordId,null);

      const member = await this.bot.getMember(this.players[data.discordId].discordId);
      const avatarURL = member.displayAvatarURL();

      this.players[data.discordId].avatarURL = avatarURL;
      this.players[data.discordId].displayName = member.displayName;

    } else {
      this.players[data.discordId].socket = socket;
    }

    socket.join('admins');
    socket.join(data.discordId);
    socket.discordId = data.discordId;
    socket.emit('authd', { "success": true });
    this.updateAdminUI();
  }


  updateAdminUI() {
    this.io.to('admins').emit('adminStatus', this.adminGameStatus());
  }

  adminGameStatus() {


    return {
      hostState: this.getHostState(),
      gameState: this.getGameState(),
      phones: this.phoneManager.getAllPhones(),
      //playerState: this.players.map(p => p.toSimple())
    }
  }

  updateSimTime(clockMsg) {
    const sim = this.sims.find(s => s.id === clockMsg["area_id"]);
    if (sim) {
      sim.time = ClockData.fromSimMessage(clockMsg);
      this.sendGameUpdateToPlayers();
    } else {
      console.error(chalk.red('CLOCK UPDATE RECEIVED BUT NO MATCHING SIM ENABLED'), clockMsg["area_id"]);
    }
  }

  // ============================= ADMIN STUFF =================================== 

  /**
   * Remove a game and clean up all associated resources
   * @param {string} simId The simulation ID to remove
   * @param {boolean} preservePhones If true, keeps all phones from the simulation
   * @param {boolean} preserveState If true, preserves simulation state
   * @returns {Promise<{panels: Array, time: object, connectionsOpen: boolean}|null>} Returns preserved simulation state if preserveState is true
   */
  async deactivateGame(simId, preservePhones = false, preserveState = false) {
    // First, find all neighbor panels that might need phones preserved
    const sim = this.getSimById(simId);
    if (!sim) return null;

    let preservedState = null;
    if (preserveState) {
      preservedState = {
        panels: [...sim.panels],
        time: sim.time,
        connectionsOpen: sim.connectionsOpen,
      };
    }

    // Get all active simulations except the one being removed
    const activeSims = this.sims.filter(s => s.id !== simId);
    
    // Create a set of panel IDs that need their phones preserved
    const preservePanelIds = new Set();
    
    if (!preservePhones) {
      console.log(chalk.yellow('deactivateSimulation'), chalk.green('Checking neighbor panels for preservation...'));
      // Check each panel in the removed sim
      sim.panels.forEach(panel => {
        // First check if this panel is a neighbor of any active sim's panels
        const isNeighborOfActive = activeSims.some(activeSim =>
          activeSim.panels.some(activePanel =>
            activePanel.neighbours.some(n => n.simId === simId && n.panelId === panel.id)
          )
        );

        // Then check if this panel has neighbors in any active sim
        const hasActiveNeighbors = panel.neighbours.some(neighbor =>
          activeSims.some(s => s.id === neighbor.simId)
        );

        if (isNeighborOfActive || hasActiveNeighbors) {
          preservePanelIds.add(panel.id);
          console.log(chalk.yellow('deactivateSimulation'), chalk.green('Preserving phone for panel:'), chalk.white(panel.id));
        }
      });
    }

    // First, deactivate the interface gateway
    if (sim.config.interfaceGateway?.enabled) {
      this.stompManager.deactivateClientForGame(simId);
    }

    // Remove phones that aren't needed anymore
    this.phoneManager.phones = this.phoneManager.phones.filter(phone => {
      if (phone.getLocation()?.simId === simId) {
        // Keep all phones if preservePhones is true
        if (preservePhones) return true;
        // Otherwise, keep the phone if its panel needs to be preserved
        return preservePanelIds.has(phone.getLocation().panelId);
      }
      return true;
    });

    // Get list of sims that will remain active
    const remainingActiveSims = this.sims.filter(s => s.id !== simId);

    // Remove simulation from active sims and clean up phones
    this.sims = remainingActiveSims;
    if (!preservePhones) {
      this.phoneManager.removeSim(simId, (id, loadIfNotExists) => this.getSimData(id, loadIfNotExists));
    }

    // Remove STOMP client
    this.stompManager.removeClientForGame(simId);

    return preservedState;

    // Send updates
    this.sendGameUpdateToPlayers();
  }

  /**
   * Add a new host and activate it immediately
   * @param {*} hostConfig The new host configuration
   */
  async addHost(hostConfig) {
    // Create and validate the Host instance
    let newHost;
    try {
      // Handle authentication if provided
      if (hostConfig.interfaceGateway?.username && hostConfig.interfaceGateway?.password) {
        // Create host first
        newHost = Host.fromConfig(hostConfig);
        // Set authentication (this will encrypt the password)
        newHost.interfaceGateway.setAuthentication(
          hostConfig.interfaceGateway.username,
          hostConfig.interfaceGateway.password
        );
      } else {
        // No authentication provided, create normally
        newHost = Host.fromConfig(hostConfig);
      }

      // Ensure interfaceGateway is disabled by default
      if (hostConfig.interfaceGateway) {
        hostConfig.interfaceGateway.enabled = false;
      }
      newHost.interfaceGateway.enabled = false;
      
      // Force new hosts to be disabled by default for security and operational safety
      newHost.enabled = false;
      newHost.validate();
    } catch (error) {
      throw new Error(`Invalid host configuration: ${error.message}`);
    }

    // Check if simulation file exists
    try {
      const testSim = this.getSimData(newHost.sim, true);
      if (!testSim) {
        throw new Error(`Simulation ${newHost.sim} not found`);
      }
    } catch (error) {
      throw new Error(`Failed to load simulation ${newHost.sim}: ${error.message}`);
    }

    // Check if a host with the same simulation ID already exists
    const existingHost = this.hosts.find(host => host.sim === newHost.sim);
    if (existingHost) {
      throw new Error(`A host for simulation '${newHost.sim}' already exists. Only one host per simulation is allowed.`);
    }

    // Add to hosts array
    this.hosts.push(newHost);
    
    try {
      // Sync with config and save first in case activation fails
      this.syncHostsWithConfig();
      await this.saveConfig(this.config);
      
      // Activate the new game
      await this.activateGame(newHost);
      
      // Update all clients
      this.sendGameUpdateToPlayers();
      
      return true;
    } catch (error) {
      // If activation fails, remove from hosts and save
      this.hosts = this.hosts.filter(host => host.sim !== newHost.sim);
      this.syncHostsWithConfig();
      await this.saveConfig(this.config);
      throw error;
    }
  }

  /**
   * Save the current configuration to disk
   * @param {*} newConfig The new configuration to save
   */
  async saveConfig(newConfig) {
    await this.configurationManager.saveConfig(newConfig);
    this.config = newConfig;
  }

  /**
   * Get all available voice channels regardless of host state
   * @returns {Promise<Array<{id: string, name: string}>>}
   */
  /**
   * Get all available voice channels from the bot's cached list
   * @returns {Promise<Array<{id: string, name: string}>>}
   */
  async getAvailableVoiceChannels() {
    return this.bot.getVoiceChannels();
  }
}
