// @ts-check
import chalk from 'chalk'
import fs from 'fs';
import Player from './model/player.js';
import Simulation from './model/simulation.js';
import ClockData from './model/clockData.js';
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
  config = null;
  channels = null;
  io = null;
  bot = null;
  phoneManager = null;
  stompManager = null;

  /**
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
    // Only activate enabled games
    config.games.filter(g => g.enabled).forEach(g => { this.activateGame(g) }, this);
  }

  /**
   * Read simulation file from disk
   * @private
   * @param {string} simId 
   * @returns {object|null} Raw simulation config or null if file doesn't exist
   */
  _readSimFile(simId) {
    const filePath = new URL(`../simulations/${simId}.json`, import.meta.url);
    try {
      const simConfig = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      return simConfig;
    } catch (e) {
      console.error(chalk.red(`Couldn't read simulation file for ${simId}:`), e);
      return null;
    }
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
    const simConfig = this._readSimFile(simId);
    if (!simConfig) return;

    console.log(chalk.yellow('getSimData'), chalk.green('Loading simulation from disk:'), chalk.white(simId));
    return Simulation.fromSimData(simId, simConfig);
  }

  /**
   * Gets basic simulation metadata without loading the full simulation
   * @param {string} simId 
   * @returns {{id: string, name: string}}
   */
  getSimMetadata(simId) {
    const simConfig = this._readSimFile(simId);
    return {
      id: simId,
      name: simConfig?.name || simId
    };
  }

  /**
   * Get list of available simulations and their metadata
   * @returns {Promise<{id: string, name: string}[]>}
   */
  async getAvailableSimulations() {
    const simPath = new URL('../simulations', import.meta.url);
    try {
      const files = await fs.promises.readdir(simPath);
      return files
        .filter(file => file.endsWith('.json'))
        .map(file => {
          const simId = file.replace('.json', '');
          return this.getSimMetadata(simId);
        });
    } catch (e) {
      console.error(chalk.red('Error reading simulations directory:'), e);
      return [];
    }
  }

  /**
   * Update an existing host configuration
   * @param {string} originalSimId The original simulation ID
   * @param {object} hostConfig The new host configuration
   */
  async updateHost(originalSimId, hostConfig) {
    const existingHost = this.config.games.find(g => g.sim === originalSimId);
    if (!existingHost) {
      throw new Error("Host not found");
    }

    // Save old connection state
    const wasEnabled = existingHost.interfaceGateway.enabled;
    
    // If sim ID hasn't changed, we need to preserve phones
    const preservePhones = hostConfig.sim === originalSimId;
    
    // Deactivate the old simulation, preserving state if not changing sims
    const preservedState = await this.deactivateGame(originalSimId, preservePhones, hostConfig.sim === originalSimId);
    
    // Remove existing host from config
    this.config.games = this.config.games.filter(g => g.sim !== originalSimId);
    
    // Add new host config, preserving IG state
    hostConfig.interfaceGateway.enabled = wasEnabled;
    this.config.games.push(hostConfig);

    // Save config
    await this.saveConfig(this.config);
    
    // Reactivate if needed
    if (hostConfig.sim === originalSimId && preservedState) {
      await this.activateGame(hostConfig, preservedState);
    } else if (wasEnabled) {
      await this.activateGame(hostConfig);
    }
    
    this.sendGameUpdateToPlayers();
  }

  /**
   * Delete a host and clean up its resources
   * @param {string} simId The simulation ID to delete
   */
  async deleteHost(simId) {
    const existingHost = this.config.games.find(g => g.sim === simId);
    if (!existingHost) {
      throw new Error("Host not found");
    }

    // Clean up simulation and all its resources
    await this.deactivateGame(simId);

    // Remove from config and save
    this.config.games = this.config.games.filter(g => g.sim !== simId);
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
   * @param {*} game The game configuration to activate
   * @param {object|null} preservedState Optional preserved state to restore
   */
  activateGame(game, preservedState = null) {
    // Check if sim is already loaded
    const existingSim = this.sims.find(s => s.id === game.sim);
    if (existingSim) {
      // If sim already exists, just update the stomp client without recreating phones
      this.stompManager.createClientForGame(game, game.interfaceGateway.port);
      return;
    }

    // Load the simulation data since this is an enabled host
    this.stompManager.createClientForGame(game, game.interfaceGateway.port);
    const sim = this.getSimData(game.sim, true) // true to load if not exists
    if (sim) {
      console.log(chalk.yellow('activateGame'), chalk.green('Loading phones for sim:'), chalk.white(game.sim));
      
      // Generate phones for all panels in this sim
      this.phoneManager.generatePhonesForSim(sim);
      
      // Generate any missing neighbor phones for all active sims
      this.phoneManager.generateMissingNeighbourPhones(this);

      // If we have preserved state, restore it
      if (preservedState) {
        sim.panels = preservedState.panels;
        sim.time = preservedState.time;
        sim.connectionsOpen = preservedState.connectionsOpen;
      }

      sim.config = {
        channel: game.channel,
        host: game.host,
        port: game.port,
        interfaceGateway: game.interfaceGateway,
      };
      this.sims.push(sim);
    } else {
      console.error('Unable to find simulation for', game.sim);
    }
  }

  enableInterfaceGateway(simId) {
    try {
      // Find the host configuration
      const host = this.config.games.find(g => g.sim === simId);
      if (!host) {
        throw new Error("Host configuration not found");
      }
      if (!host.enabled) {
        throw new Error("Cannot enable Interface Gateway: Host is disabled");
      }

      // Activate the Interface Gateway client
      const result = this.stompManager.activateClientForGame(simId);
      this.updateAdminUI();
      return result;
    } catch (error) {
      console.error(chalk.red("Failed to enable Interface Gateway:"), error);
      throw error;
    }
  }

  disableInterfaceGateway(simId) {
    try {
      this.stompManager.deactivateClientForGame(simId);
      this.updateAdminUI();
    } catch (error) {
      console.error(chalk.red("Failed to disable Interface Gateway:"), error);
      throw error;
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
    const host = this.config.games.find(g => g.sim === simId);
    if (host) {
      host.enabled = true;
      await this.saveConfig(this.config);
      
      // Activate the game when enabled
      console.log(chalk.yellow('enableHost'), 'Activating game for', simId);
      await this.activateGame(host);
      
      this.updateAdminUI();
      this.sendGameUpdateToPlayers();
    }
  }

  async disableHost(simId) {
    const host = this.config.games.find(g => g.sim === simId);
    if (host) {
      // If IG is enabled, disable it first
      if (host.interfaceGateway.enabled) {
        this.disableInterfaceGateway(simId);
      }
      
      // Deactivate the simulation first
      await this.deactivateGame(simId);
      
      host.enabled = false;
      await this.saveConfig(this.config);
      
      // After disabling a host, regenerate missing neighbor phones for remaining active sims
      this.phoneManager.generateMissingNeighbourPhones(this);
      
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
    //Assign the player to the panel
    panel.player = user;
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
    //Assign the player to the panel
    panel.player = undefined;
    this.phoneManager.unassignPhone(panel.phone);
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
    //console.log(this.sims);
    return this.sims.filter(s => s.enabled);
  }

  getHostState() {
    return this.config.games;
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
      this.phoneManager.removeSim(simId, this);
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
    // Validate the host config first
    if (!hostConfig.sim || !hostConfig.host || !hostConfig.channel || !hostConfig.interfaceGateway?.port) {
      throw new Error("Invalid host configuration");
    }

    // Ensure interfaceGateway is disabled by default
    hostConfig.interfaceGateway.enabled = false;

    // Check if simulation file exists
    try {
      const testSim = this.getSimData(hostConfig.sim, true);
      if (!testSim) {
        throw new Error(`Simulation ${hostConfig.sim} not found`);
      }
    } catch (error) {
      throw new Error(`Failed to load simulation ${hostConfig.sim}: ${error.message}`);
    }

    // Add to config
    this.config.games.push(hostConfig);
    
    try {
      // Save config first in case activation fails
      await this.saveConfig(this.config);
      
      // Activate the new game
      await this.activateGame(hostConfig);
      
      // Update all clients
      this.sendGameUpdateToPlayers();
      
      return true;
    } catch (error) {
      // If activation fails, remove from config and save
      this.config.games = this.config.games.filter(g => g.sim !== hostConfig.sim);
      await this.saveConfig(this.config);
      throw error;
    }
  }

  /**
   * Save the current configuration to disk
   * @param {*} newConfig The new configuration to save
   */
  async saveConfig(newConfig) {
    try {
      fs.writeFileSync('./config.json', JSON.stringify(newConfig, null, 2), 'utf8');
      this.config = newConfig;
      console.log(chalk.green('Config saved successfully'));
    } catch (error) {
      console.error(chalk.red('Error saving config:'), error);
      throw error;
    }
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