// @ts-check
import chalk from 'chalk'
import User from './model/user.js';
import Player from './model/player.js';
import Admin from './model/admin.js';
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
  // Constants
  static LOGIN_EVENTS = {
    LOGGED_IN: 'loggedIn',
    GAME_INFO: 'gameInfo',
    PLAYER_INFO: 'playerInfo',
    ADMIN_STATUS: 'adminStatus',
    VOICE_CHANNELS_UPDATE: 'voiceChannelsUpdate',
    AUTHD: 'authd'
  };

  static ERRORS = {
    ROC_VC_DISCONNECTED: 'ROC_VC_DISCONNECTED',
    INVALID_DISCORD_USERNAME: 'That isn\'t a discord username.'
  };

  users = {};
  /** @type {Simulation[]} */
  sims = [];
  /** @type {Host[]} */
  hosts = [];
  /**
   * Locks for concurrent addHost operations keyed by sim id
   * @type {Set<string>}
   */
  hostAddLocks = new Set();

  /**
   * Locks for concurrent updateHost operations keyed by sim id(s)
   * @type {Set<string>}
   */
  hostUpdateLocks = new Set();

  config = null;
  channels = null;
  io = null;
  bot = null;
  phoneManager = null;
  callManager = null;
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
  }

  /**
   * Set the call manager instance
   * @param {*} callManager The call manager instance
   */
  setCallManager(callManager) {
    this.callManager = callManager;
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
    
    // Initialize CallGroups after games are activated
    this.initializeCallGroups();
  }

  /**
   * Initialize CallGroups for all active simulations
   */
  initializeCallGroups() {
    // Load CallGroups for each active simulation
    this.sims.forEach(sim => {
      if (sim && sim.enabled) {
        this.phoneManager.loadCallGroupsForSim(sim, "default");
      }
    });
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
   * Update an existing host configuration (defensive: locking, validation, rollback)
   * @param {string} originalSimId The original simulation ID
   * @param {object} hostConfig The new host configuration
   */
  async updateHost(originalSimId, hostConfig) {
    if (!originalSimId) {
      throw new Error('Original simulation id is required');
    }

    // Defensive clone
    const cfg = (typeof structuredClone === 'function') ? structuredClone(hostConfig) : JSON.parse(JSON.stringify(hostConfig));
    const targetSimId = cfg?.sim || originalSimId;

    // Determine locks to acquire (unique, sorted to avoid deadlocks)
    const locksToAcquire = Array.from(new Set([originalSimId, targetSimId])).sort();

    // Ensure no conflicting operations in progress on these sims
    for (const id of locksToAcquire) {
      if (this.hostAddLocks.has(id) || this.hostUpdateLocks.has(id)) {
        throw new Error(`Operation already in progress for simulation '${id}'`);
      }
    }

    // Acquire locks
    locksToAcquire.forEach(id => this.hostUpdateLocks.add(id));

    let existingHost;
    let preservedState = null;

    try {
      existingHost = this.getHostById(originalSimId);
      if (!existingHost) {
        throw new Error(`Host '${originalSimId}' not found`);
      }

      // Save old connection state so it can be preserved on the new host
      const wasIGEnabled = existingHost.interfaceGateway.enabled;

      // If changing target sim, ensure target simulation exists and isn't already claimed by another host
      if (targetSimId !== originalSimId) {
        const targetSim = this.getSimData(targetSimId, true);
        if (!targetSim) {
          throw new Error(`Simulation '${targetSimId}' not found`);
        }
        const conflictingHost = this.hosts.find(h => h.sim === targetSimId);
        if (conflictingHost) {
          throw new Error(`A host for simulation '${targetSimId}' already exists. Only one host per simulation is allowed.`);
        }
      }

      // If sim ID hasn't changed, preserve phones and state
      const preservePhones = targetSimId === originalSimId;
      preservedState = await this.deactivateGame(originalSimId, preservePhones, preservePhones);

      // Remove the existing host from in-memory list (we'll re-add the new or rollback)
      const oldHostCopy = existingHost;
      this.hosts = this.hosts.filter(h => h.sim !== originalSimId);

      // Build and validate new host
      let newHost;
      try {
        newHost = Host.fromConfig(cfg);

        // Preserve IG state and clear transient fields
        newHost.interfaceGateway.enabled = wasIGEnabled;
        newHost.interfaceGateway.connectionState = 'disconnected';
        newHost.interfaceGateway.errorMessage = undefined;

      } catch (err) {
        // Invalid new host config - rollback and re-activate original host if necessary
        this.hosts.push(oldHostCopy);
        try { await this.updateAndSave(); } catch (cleanupErr) { console.error(chalk.red('Failed to persist rollback after invalid update:'), cleanupErr); }
        if (wasIGEnabled) {
          try { await this.activateGame(oldHostCopy, preservedState); } catch (reactErr) { console.error(chalk.red('Failed to reactivate original host after invalid update:'), reactErr); }
        }
        throw new Error(`Invalid host configuration: ${err.message}`);
      }

      // Temporarily add the new host and persist
      this.hosts.push(newHost);

      try {
        await this.updateAndSave();
      } catch (saveErr) {
        // Persist failed: rollback to original host
        this.hosts = this.hosts.filter(h => h.sim !== newHost.sim);
        this.hosts.push(oldHostCopy);
        try { await this.updateAndSave(); } catch (cleanupErr) { console.error(chalk.red('Failed to persist rollback after save error:'), cleanupErr); }
        if (wasIGEnabled) {
          try { await this.activateGame(oldHostCopy, preservedState); } catch (reactErr) { console.error(chalk.red('Failed to reactivate original host after save rollback:'), reactErr); }
        }
        throw new Error(`Failed to save config after updating host '${originalSimId}': ${saveErr.message}`);
      }

      // Activate the new host as appropriate, rolling back on activation failure
      try {
        if (targetSimId === originalSimId && preservedState) {
          await this.activateGame(this.getHostById(targetSimId), preservedState);
        } else if (wasIGEnabled) {
          await this.activateGame(this.getHostById(targetSimId));
        }
      } catch (activateErr) {
        // Rollback host change
        const newlyAddedHostSim = targetSimId;
        this.hosts = this.hosts.filter(h => h.sim !== newlyAddedHostSim);
        this.hosts.push(oldHostCopy);
        try { await this.updateAndSave(); } catch (cleanupErr) { console.error(chalk.red('Failed to persist rollback after activation failure:'), cleanupErr); }
        if (wasIGEnabled) {
          try { await this.activateGame(oldHostCopy, preservedState); } catch (reactErr) { console.error(chalk.red('Failed to reactivate original host after activation failure:'), reactErr); }
        }
        throw new Error(`Failed to activate host '${targetSimId}': ${activateErr.message}`);
      }

    } finally {
      // Always release locks
      locksToAcquire.forEach(id => this.hostUpdateLocks.delete(id));
    }
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
    await this.updateAndSave();
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
   * Helper method to update configuration, sync and save
   */
  async updateAndSave() {
    this.syncHostsWithConfig();
    await this.saveConfig(this.config);
    this.updateAdminUI();
    this.sendGameUpdateToPlayers();
  }

  /**
   * @param {Host|*} host The host instance or game configuration to activate
   * @param {object|null} preservedState Optional preserved state to restore
   */
  activateGame(host, preservedState = null) {
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
      // Generate phones for all panels in this sim (including neighbor phones)
      sim.panels = this.phoneManager.generatePhonesForSim(sim);

      // If we have preserved state, restore it
      if (preservedState) {
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
      
      // Update UI to reflect transient IG change (do not persist IG runtime state)
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
      }
      
      // Remove client completely instead of just deactivating
      this.stompManager.removeClientForGame(simId);
      // Update UI only; do not persist transient IG state
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
      // Update UI only; do not persist transient IG connection state
      this.updateAdminUI();
    }
  }

  /**
   * Notify admin clients that voice channels have changed
   */
  async notifyVoiceChannelUpdate() {
    const channels = await this.getAvailableVoiceChannels();
    this.io.to('admins').emit(ROCManager.LOGIN_EVENTS.VOICE_CHANNELS_UPDATE, channels);
  }

  async enableHost(simId) {
    const host = this.getHostById(simId);
    if (host) {
      host.enable();
      // Activate the game when enabled
      await this.activateGame(host);
      await this.updateAndSave();
      
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
      await this.updateAndSave();
    }
  }

  enableConnections(simId) {
    this.getSimById(simId).connectionsOpen = true;
    this.sendGameUpdateToPlayers();
  }

  disableConnections(simId) {
    this.getSimById(simId).connectionsOpen = false;
    this.sendGameUpdateToPlayers();
  }

  // ============================ BEGIN PLAYER CODE ============================

  /**
   * Handle Discord voice channel events - users joining/leaving voice channels
   * @param {string} discordId - Discord user ID
   * @param {string|null} voiceChannelId - Voice channel ID (null if leaving voice)
   */
  async handleVoiceStateUpdate(discordId, voiceChannelId) {
    if (discordId in this.users) {
      const user = this.users[discordId];
      
      if (voiceChannelId === null) {
        // User left voice channel - before clearing their voice state, attempt to remove them from any active calls
        try {
          if (this.callManager) {
            const phones = this.phoneManager.getPhonesForDiscordId(discordId) || [];
            for (const phone of phones) {
              for (const call of Array.from(this.callManager.activeCalls.values())) {
                if (call.includesPhone && call.includesPhone(phone)) {
                  const socketId = user.socket?.id;
                  if (socketId) {
                    // @ts-ignore - leaveCall returns Promise<boolean>
                    await this.callManager.leaveCall(socketId, call.id).catch((err) => {
                      console.warn('Error forcing leaveCall after voice disconnect:', err?.message || err);
                    });
                  }
                }
              }
            }
          }
        } catch (err) {
          console.warn('handleVoiceStateUpdate: error checking calls for voice leave', err?.message || err);
        }

        // Now clear the user's voice state
        user.updateVoiceChannel(null);

        // If user left voice while still connected via socket, notify client
        if (!user.socket.disconnected) {
          this.io.to(discordId).emit(ROCManager.LOGIN_EVENTS.LOGGED_IN, {
            "loggedIn": false,
            "error": ROCManager.ERRORS.ROC_VC_DISCONNECTED
          });
        } else {
          this.checkDisconnectingUser(user);
        }

      } else {
        // User joined/changed voice channel
        user.updateVoiceChannel(voiceChannelId);
        if (user.socket && !user.socket.disconnected) {
          // User is now fully connected again
          this.io.to(discordId).emit(ROCManager.LOGIN_EVENTS.LOGGED_IN, {
            "loggedIn": true,
            "error": ""
          });
          this.sendGameUpdateToUser(user);
          this.updateUserInfo(user);
        }
      }
    }
  }

  updatePlayerPanel(user, panel) {
    const player = this.users[user];
    if (player && typeof player.setPanel === 'function') {
      player.setPanel(panel);
    } else {
      // Fallback for backward compatibility
      player.panel = panel;
    }
    this.sendGameUpdateToPlayers();
  }

  /**
   * @param {string} socketId 
   * @returns {User}
   */
  findUserBySocketId(socketId) {
    for (const [key, value] of Object.entries(this.users)) {
      if (value.socket && value.socket.id === socketId) {
        return this.users[key];
      }
    }
    return null;
  }

  /**
   * Get user by Discord ID directly (fallback for socket resolution issues)
   * @param {string} discordId - Discord ID to lookup
   * @returns {User|null} User instance if found
   */
  getUserByDiscordId(discordId) {
    return this.users[discordId] || null;
  }

  /**
   * Find active socket connection for a Discord user (for validation)
   * @param {string} discordId - Discord ID to check
   * @returns {string|null} Active socket ID if found and connected
   */
  getActiveSocketId(discordId) {
    const user = this.getUserByDiscordId(discordId);
    if (user && user.socket && !user.socket.disconnected) {
      return user.socket.id;
    }
    return null;
  }

  isUser(discordId) {
    return !!this.users[discordId];
  }

  isAdmin(discordId) {
    return this.users[discordId] instanceof Admin;
  }

  /**
   * Get all admin users currently in the system
   * @returns {Admin[]} Array of admin users
   */
  getAllAdmins() {
    return Object.values(this.users).filter(user => user instanceof Admin);
  }




  /**
   * @param {User} user 
   * @returns {boolean}
   */
  checkDisconnectingUser(user) {
    if (!user) {
      return false;
    }

    // Updated: Consistent disconnect handling for all user types
    // All users (including admins) must maintain Discord voice connection
    this.bot.getUserVoiceChannel(user.discordId).then((userChannel) => {
      if (userChannel === null && user.socket.disconnected) {
        // All users not in voice: delete consistently
        console.log(chalk.yellow('ROCManager'), 
          `${user.role} user ${user.discordId} disconnected from both socket and voice - removing from system`);
        this.deleteUser(user);
      } else {
        // User still in voice: mark away and allow reconnection
        console.log(chalk.blue('ROCManager'), 
          `${user.role} user ${user.discordId} socket disconnected but still in voice - marking as away`);
        user.isConnected = false;
        this.sendGameUpdateToPlayers();
      }
    });
    
    return true;
  }

  /**
   * @param {User} user 
   */
  deleteUser(user) {
    this.phoneManager.unassignPhonesForDiscordId(user.discordId)

    // Unclaim any claimed panels
    for (const skey of Object.keys(this.sims)) {
      if (typeof this.sims[skey].panels !== "undefined") {
        for (const pkey of Object.keys(this.sims[skey].panels)) {
          if (this.sims[skey].panels[pkey].player === user.discordId) {
            this.sims[skey].panels[pkey].player = undefined;
          }
        }
      }
    }
    delete this.users[user.discordId];

    this.sendGameUpdateToPlayers();
  }

  claimPanel(user, requestedSim, requestedPanel) {
    const player = this.users[user];
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
    // Update the panel's phone to be assigned to the player
    this.updateUserInfo(player);
    this.sendGameUpdateToPlayers();
  }

  releasePanel(user, requestedSim, requestedPanel) {
    const player = this.users[user];
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
    this.updateUserInfo(player);
    this.sendGameUpdateToPlayers();
  }


  // ============================== END PLAYER CODE ==============================

  async movePlayerToVoiceChannel(playerId, channelId) {
    const player = this.users[playerId];
    if (player) {
      player.updateVoiceChannel(channelId);
      await this.bot.setUserVoiceChannel(playerId, channelId);
    }
  }

  async moveUserToLobby(socketId) {
    const user = this.findUserBySocketId(socketId);
    const channelId = this.channels.lobby;
    await this.bot.setUserVoiceChannel(user.discordId, channelId);
  }

  async markUserAFK(socketId) {
    const user = this.findUserBySocketId(socketId);
    if (user === null) {
      return false;
    }
    const channelId = this.channels.afk;
    if (channelId === null || typeof channelId === 'undefined') {
      return false;
    }
    await this.bot.setUserVoiceChannel(user.discordId, channelId);
  }

  getGameState() {
    return this.sims.filter(s => s.enabled);
  }

  getHostState() {
    return this.hosts.map(host => host.toClientObject());
  }

  // Just updates the player UI for all players
  sendGameUpdateToPlayers() {
    this.io.emit(ROCManager.LOGIN_EVENTS.GAME_INFO, this.getGameState());
    this.updateAdminUI();
  }

  sendGameUpdateToSocket(socket) {
    socket.emit(ROCManager.LOGIN_EVENTS.GAME_INFO, this.getGameState());
  }

  sendGameUpdateToUser(user) {
    this.sendGameUpdateToSocket(user.socket);
  }
  /**
   * @param {User} user 
   */
  updateUserInfo(user) {
    const phones = this.phoneManager.getPhonesForDiscordId(user.discordId);
    const pm = this.phoneManager;
    phones.forEach(p => { p.setSpeedDial(pm.getSpeedDialForPhone(p)); p.setTrainsAndMobiles(pm.getTrainsAndMobilesForPhone(p)) });
    const myPanels = [];
    this.sims.forEach(s => myPanels.concat(s.panels.filter(p => p.player === user.discordId)))
    const info = {};
    info.phones = phones.map(p => p.getPhoneBook());
    info.panels = myPanels;
    user.socket.emit(ROCManager.LOGIN_EVENTS.PLAYER_INFO, info);
  }

  // ================================= AUTHENTICATION HELPER METHODS =================================

  /**
   * Fetch user profile information from Discord
   * @param {string} discordId - Discord user ID
   * @returns {Promise<{avatarURL: string, displayName: string}>}
   */
  async _fetchUserProfile(discordId) {
    const member = await this.bot.getMember(discordId);
    return {
      avatarURL: member.displayAvatarURL(),
      displayName: member.displayName
    };
  }

  /**
   * Setup socket connection properties for a user
   * @param {User} user - User instance
   * @param {Socket} socket - Socket.IO connection
   */
  _setupSocketConnection(user, socket) {
    // Clean up any previous socket connections for this user
    if (user.socket && user.socket.id !== socket.id) {
      console.log(chalk.blue('ROCManager'), `Cleaning up previous socket ${user.socket.id} for user ${user.discordId}`);
      // Don't disconnect the old socket, just clear our reference
      // Socket.IO will handle the actual connection cleanup
    }
    
    // Join user-specific room
    socket.join(user.discordId);
    //@ts-expect-error
    socket.discordId = user.discordId;
    
    // Add admin users to admin room
    if (user instanceof Admin) {
      socket.join('admins');
    }
    
    // Update user's socket connection
    user.updateSocket(socket);
    
    console.log(chalk.blue('ROCManager'), `Socket ${socket.id} assigned to user ${user.discordId}`);
  }

  /**
   * Send standardized authentication response
   * @param {Socket} socket - Socket.IO connection
   * @param {boolean} success - Whether authentication was successful
   * @param {string|null} error - Error message if authentication failed
   * @param {string} authType - Type of authentication ('player' or 'admin')
   */
  _sendAuthResponse(socket, success, error, authType) {
    if (authType === 'admin') {
      socket.emit(ROCManager.LOGIN_EVENTS.AUTHD, { success, error });
    } else {
      socket.emit(ROCManager.LOGIN_EVENTS.LOGGED_IN, { 
        loggedIn: success, 
        error: error || "" 
      });
    }
  }

  /**
   * Update game state after user authentication
   * @param {User} user - Authenticated user
   */
  _updateGameState(user) {
    if (user instanceof Admin) {
      this.updateAdminUI();
    } else {
      this.sendGameUpdateToPlayers();
      this.updateUserInfo(user);
      this.phoneManager.sendPhonebookUpdateToUser(user.discordId);
    }
  }

  // ================================= VALIDATION HELPER METHODS =================================

  /**
   * Validate user connection requirements
   * @param {string} discordId - Discord user ID
   * @param {Socket} socket - Socket.IO connection
   * @param {string} requestedRole - Requested user role ('player' or 'admin')
   * @returns {Promise<{isValid: boolean, hasSocket: boolean, hasVoice: boolean, isAuthorized: boolean, voiceChannelId: string|null, error: string|null}>}
   */
  async _validateUserConnection(discordId, socket, requestedRole = 'player') {
    // Validate Discord ID format
    if (!discordId || discordId.length <= 2) {
      return { 
        isValid: false, 
        error: ROCManager.ERRORS.INVALID_DISCORD_USERNAME,
        hasSocket: socket !== null,
        hasVoice: false,
        isAuthorized: false,
        voiceChannelId: null
      };
    }

    // Check voice channel connection
    const voiceChannel = await this.bot.getUserVoiceChannel(discordId);
    
    // Check authorization for admin role
    const isAuthorized = requestedRole === 'admin' 
      ? this.config.superUsers.includes(discordId) 
      : true;

    const hasSocket = socket !== null;
    const hasVoice = voiceChannel !== null;
    const isValid = hasSocket && hasVoice && isAuthorized;

    return {
      isValid,
      hasSocket,
      hasVoice,
      isAuthorized,
      voiceChannelId: voiceChannel,
      error: isValid ? null : this._getConnectionError(hasSocket, hasVoice, isAuthorized)
    };
  }

  /**
   * Get appropriate error message for connection validation failure
   * @param {boolean} hasSocket - Whether user has socket connection
   * @param {boolean} hasVoice - Whether user has Discord voice connection
   * @param {boolean} isAuthorized - Whether user is authorized for requested role
   * @returns {string} Error message
   */
  _getConnectionError(hasSocket, hasVoice, isAuthorized) {
    if (!hasSocket) return 'Web UI connection required';
    if (!hasVoice) return ROCManager.ERRORS.ROC_VC_DISCONNECTED;
    if (!isAuthorized) return 'Unauthorized access';
    return 'Connection validation failed';
  }

  // ================================= USER FACTORY METHODS =================================

  /**
   * Determine actual user role based on authorization
   * @param {string} discordId - Discord user ID
   * @param {string} requestedRole - Requested role ('player' or 'admin')
   * @returns {string} Actual role ('player' or 'admin')
   */
  _determineActualRole(discordId, requestedRole) {
    // Admin role requires authorization
    if (requestedRole === 'admin') {
      return this.config.superUsers.includes(discordId) ? 'admin' : 'player';
    }
    
    // Check if existing user should be promoted to admin
    if (this.config.superUsers.includes(discordId)) {
      return 'admin';
    }
    
    return 'player';
  }

  /**
   * Create user instance based on role
   * @param {string} role - User role ('player' or 'admin')
   * @param {Socket} socket - Socket.IO connection
   * @param {string} discordId - Discord user ID
   * @param {string} voiceChannelId - Discord voice channel ID
   * @returns {User} User instance
   */
  _createUserByRole(role, socket, discordId, voiceChannelId) {
    switch (role) {
      case 'admin':
        return new Admin(socket, discordId, voiceChannelId);
      case 'player':
      default:
        return new Player(socket, discordId, voiceChannelId);
    }
  }

  /**
   * Get existing user or create new user with appropriate role
   * @param {string} discordId - Discord user ID
   * @param {Socket} socket - Socket.IO connection
   * @param {string} voiceChannelId - Discord voice channel ID
   * @param {string} requestedRole - Requested role ('player' or 'admin')
   * @returns {Promise<User>} User instance
   */
  async _getOrCreateUser(discordId, socket, voiceChannelId, requestedRole) {
    const actualRole = this._determineActualRole(discordId, requestedRole);
    
    if (this.isUser(discordId)) {
      // Handle existing user reconnection
      const existingUser = this.users[discordId];
      
      // Check if role conversion is needed
      if (actualRole === 'admin' && !(existingUser instanceof Admin)) {
        console.warn(chalk.yellow('ROCManager'), `Converting user ${discordId} to Admin role`);
        const adminUser = new Admin(socket, discordId, voiceChannelId);
        adminUser.avatarURL = existingUser.avatarURL;
        adminUser.displayName = existingUser.displayName;
        adminUser.isConnected = true;
        this.users[discordId] = adminUser;
        return adminUser;
      }
      
      // Update existing user connection
      existingUser.updateSocket(socket);
      existingUser.updateVoiceChannel(voiceChannelId);
      existingUser.isConnected = true;
      return existingUser;
    }
    
    // Create new user
    const newUser = this._createUserByRole(actualRole, socket, discordId, voiceChannelId);
    const profile = await this._fetchUserProfile(discordId);
    newUser.updateProfile(profile.avatarURL, profile.displayName);
    
    this.users[discordId] = newUser;
    return newUser;
  }

  // ================================= UNIFIED REGISTRATION METHOD =================================

  /**
   * Unified user registration method that replaces registerWebUI, addPlayer, and addAdminUser
   * @param {Socket} socket - Socket.IO connection
   * @param {string} discordId - Discord user ID
   * @param {string} requestedRole - Requested role ('player' or 'admin')
   * @returns {Promise<boolean>} Success status
   */
  async registerUser(socket, discordId, requestedRole = 'player') {
    try {
      console.log(chalk.blue('ROCManager'), `Authentication attempt for ${discordId} as ${requestedRole}`);
      
      // 1. Validate connection requirements
      const validation = await this._validateUserConnection(discordId, socket, requestedRole);
      
      if (!validation.isValid) {
        console.log(chalk.yellow('ROCManager'), 
          `Authentication failed for ${discordId}: ${validation.error}`);
        this._sendAuthResponse(socket, false, validation.error, requestedRole);
        return false;
      }
      
      // 2. Get or create user with appropriate role
      const user = await this._getOrCreateUser(
        discordId, 
        socket, 
        validation.voiceChannelId, 
        requestedRole
      );
      
      // 3. Setup socket connection
      this._setupSocketConnection(user, socket);
      
      // 4. Send success response
      this._sendAuthResponse(socket, true, null, user.role);
      
      // 5. Update game state
      this._updateGameState(user);
      
      console.log(chalk.green('ROCManager'), 
        `${user.role} user ${discordId} successfully authenticated with socket ${socket.id}`);
      
      return true;
      
    } catch (error) {
      console.error(chalk.red('ROCManager'), `Authentication error for ${discordId}:`, error);
      console.error(chalk.red('ROCManager'), 'Error details:', {
        message: error.message,
        stack: error.stack,
        name: error.name
      });
      this._sendAuthResponse(socket, false, 'Authentication failed', requestedRole);
      return false;
    }
  }

  // ================================================= ADMIN STUFF ================================================= 

  /**
   * Legacy method wrapper - use registerUser() instead
   * @param {object} data - Contains discordId
   * @param {Socket} socket - Socket.IO connection
   */
  async addAdminUser(data, socket) {
    // Use the new unified registration system
    return await this.registerUser(socket, data.discordId, 'admin');
  }


  updateAdminUI() {
    this.io.to('admins').emit(ROCManager.LOGIN_EVENTS.ADMIN_STATUS, this.adminGameStatus());
  }

  adminGameStatus() {
    const adminStatus = {
      hostState: this.getHostState(),
      gameState: this.getGameState(),
      phones: this.phoneManager.getAllPhones(),
      groupCalls: [],
      privateCalls: {}
      //playerState: this.players.map(p => p.toSimple())
    };
    
    // Add call manager data for admin interface
    if (this.callManager) {
      // Add private calls from UnifiedCallManager (P2P and GROUP calls)
      adminStatus.privateCalls = this.callManager.getAllPrivateCalls();
      
      // Add group call information from UnifiedCallManager (REC calls)
      const activeGroupCalls = this.callManager.getAllActiveGroupCalls();
      adminStatus.groupCalls = activeGroupCalls.map(groupCall => ({
        id: groupCall.id,
        type: groupCall.type,
        level: groupCall.level,
        senderPhoneId: groupCall.sender?.getId() || 'unknown',
        participantCount: groupCall.getAllPhones().length,
        status: groupCall.status,
        timePlaced: groupCall.timePlaced,
        channelId: groupCall.channel?.id || null,
        participants: groupCall.getAllPhones().map(phone => ({
          phoneId: phone.getId(),
          discordId: phone.getDiscordId()
        }))
      }));
    }
    
    return adminStatus;
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
  }

  /**
   * Add a new host and activate it immediately (defensive: locks, validations, rollback)
   * @param {*} hostConfig The new host configuration
   */
  async addHost(hostConfig) {
    // Defensive clone to avoid mutating the caller's object
    const cfg = (typeof structuredClone === 'function') ? structuredClone(hostConfig) : JSON.parse(JSON.stringify(hostConfig));
    const simId = cfg?.sim;

    if (!simId) {
      throw new Error('Invalid host configuration: missing sim id');
    }

    // Prevent concurrent adds for the same simulation
    if (this.hostAddLocks.has(simId)) {
      throw new Error(`Add operation already in progress for simulation '${simId}'`);
    }

    this.hostAddLocks.add(simId);

    let newHost;
    try {
      // Fail-fast: ensure simulation exists before mutating state
      try {
        const testSim = this.getSimData(simId, true);
        if (!testSim) {
          throw new Error(`Simulation ${simId} not found`);
        }
      } catch (err) {
        throw new Error(`Failed to load simulation '${simId}': ${err.message}`);
      }

      // Prevent duplicates
      const existingHost = this.hosts.find(h => h.sim === simId);
      if (existingHost) {
        throw new Error(`A host for simulation '${simId}' already exists. Only one host per simulation is allowed.`);
      }

      // Build Host instance and validate
      try {
        newHost = Host.fromConfig(cfg);

        // If auth provided, set it securely (do not log credentials)
        if (cfg.interfaceGateway?.username && cfg.interfaceGateway?.password) {
          newHost.interfaceGateway.setAuthentication(cfg.interfaceGateway.username, cfg.interfaceGateway.password);
        }

        // Ensure interface gateway is disabled by default and host is disabled
        newHost.interfaceGateway.enabled = false;
        newHost.interfaceGateway.connectionState = 'disconnected';
        newHost.interfaceGateway.errorMessage = undefined;
        newHost.enabled = false;

        newHost.validate();
      } catch (err) {
        throw new Error(`Invalid host configuration: ${err.message}`);
      }

      // Persist host to in-memory list and save config
      this.hosts.push(newHost);

      try {
        await this.updateAndSave();
      } catch (saveErr) {
        // Rollback addition and attempt to persist rollback; surface the original save error
        this.hosts = this.hosts.filter(h => h.sim !== newHost.sim);
        try { await this.updateAndSave(); } catch (cleanupErr) { console.error(chalk.red('Failed to rollback after save error:'), cleanupErr); }
        throw new Error(`Failed to save config after adding host '${simId}': ${saveErr.message}`);
      }

      // Activate the new game (activation errors trigger rollback)
      try {
        await this.activateGame(newHost);
      } catch (activateErr) {
        // Rollback host from in-memory and attempt to persist; don't swallow original activation error
        this.hosts = this.hosts.filter(h => h.sim !== newHost.sim);
        try { await this.updateAndSave(); } catch (cleanupErr) { console.error(chalk.red('Failed to persist removal after activation failure:'), cleanupErr); }
        throw new Error(`Failed to activate host '${simId}': ${activateErr.message}`);
      }

      return true;
    } finally {
      // Always release the lock
      this.hostAddLocks.delete(simId);
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
