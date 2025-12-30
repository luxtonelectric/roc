// @ts-check
import chalk from 'chalk';

import {Client, GatewayIntentBits, VoiceChannel, TextChannel, CategoryChannel, NewsChannel, StageChannel, ForumChannel} from 'discord.js';
/** @typedef {import("./ROCManager.js").default} ROCManager */


export default class DiscordBot {
  /** @type {ROCManager} */
  gameManager;

  /** @type {Array} */
  privateCallChannels = [];

  /** @type {Array} */
  voiceChannels = [];

  /**
   * @param {string} token
   * @param {string} prefix
   * @param {string} guildId
   * @param {import('discord.js').Client} [client] - Optional injected client (useful for tests)
   */
  constructor (token, prefix, guildId, client = null)
  {
    // Allow dependency injection of the Client for tests; otherwise create a real Client
    this.client = client || new Client({intents:[GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.GuildMembers, GatewayIntentBits.GuildVoiceStates, GatewayIntentBits.GuildPresences]});
    this.token = token;
    this.prefix = prefix;
    this.guildId = guildId;
    this.gameManager = null;

    // Internal state to manage handler attachment
    this.handlersAttached = false;
  }
  
  /**
   * 
   * @param {ROCManager} gameManager 
   */
  setGameManager(gameManager)
  {
    this.gameManager = gameManager;
  }

  /**
   * Attach default event handlers to the managed Discord client.
   * This is extracted so tests can call handlers directly or attach a mock client.
   */
  attachEventHandlers() {
    if (this.handlersAttached) return;

    // Production-correct event names for discord.js v14

    // store references so we can remove them in tests
    this._onReady = () => { void this.onClientReady(); };
    this._onMessage = msg => { void this.onMessage(msg); };
    this._onChannelCreate = channel => { void this.onChannelCreate(channel); };
    this._onChannelDelete = channel => { void this.onChannelDelete(channel); };
    this._onChannelUpdate = (oldChannel, newChannel) => { void this.onChannelUpdate(oldChannel, newChannel); };
    this._onVoiceStateUpdate = (oldState, newState) => { void this.onVoiceStateUpdate(oldState, newState); };

    this.client.on('ready', this._onReady);
    this.client.on('messageCreate', this._onMessage);
    this.client.on('channelCreate', this._onChannelCreate);
    this.client.on('channelDelete', this._onChannelDelete);
    this.client.on('channelUpdate', this._onChannelUpdate);
    this.client.on('voiceStateUpdate', this._onVoiceStateUpdate);

    this.handlersAttached = true;
  }

  /**
   * Detach event handlers (useful for tests to avoid interference)
   */
  detachEventHandlers() {
    if (!this.handlersAttached) return;

    if (this._onReady) this.client.off('ready', this._onReady);
    if (this._onMessage) this.client.off('messageCreate', this._onMessage);
    if (this._onChannelCreate) this.client.off('channelCreate', this._onChannelCreate);
    if (this._onChannelDelete) this.client.off('channelDelete', this._onChannelDelete);
    if (this._onChannelUpdate) this.client.off('channelUpdate', this._onChannelUpdate);
    if (this._onVoiceStateUpdate) this.client.off('voiceStateUpdate', this._onVoiceStateUpdate);

    delete this._onReady;
    delete this._onMessage;
    delete this._onChannelCreate;
    delete this._onChannelDelete;
    delete this._onChannelUpdate;
    delete this._onVoiceStateUpdate;

    this.handlersAttached = false;
  }

  /**
   * Register and start the bot (login and attach handlers). Returned promise resolves when login completes.
   */
  async setUpBot() {
    // Ensure handlers are attached before login so tests can mock and emit events
    this.attachEventHandlers();

    try {
      await this.client.login(this.token);
      console.info(chalk.blueBright("Discord.js"), chalk.yellow("Login"), chalk.green("Login Successful!"));
    } catch (x) {
      console.error(chalk.blueBright("Discord.js"), chalk.yellow("Login"), chalk.red("Login Error"), x.toString());
    }
  }

  /**
   * The following methods are the bound handlers for discord events. Tests can call these directly.
   */
  async onClientReady() {
    console.info(chalk.blueBright("Discord.js"), chalk.yellow("Ready"), chalk.green("Logged in as:", chalk.white(this.client?.user?.tag || 'unknown')));
    // Initial channel load
    try {
      await this.updateVoiceChannels();
    } catch (err) {
      console.warn(chalk.yellow('updateVoiceChannels failed during ready handler'), err?.message || err);
    }
  }

  onMessage(msg) {
    try {
      if (!msg || !msg.content) return;
      if (msg.content === `${this.prefix}ping`) {
        msg.reply('Pong!');
      }
    } catch (err) {
      console.warn(chalk.red('onMessage handler error'), err?.message || err);
    }
  }

  async onChannelCreate(channel) {
    try {
      if (channel.isVoiceBased?.()) {
        let channelName = 'Unknown';
        if (channel instanceof VoiceChannel || channel instanceof StageChannel) {
          channelName = channel.name;
        }
        console.info(chalk.blueBright("Discord.js"), chalk.yellow("Channel"), chalk.green("Created voice channel:", chalk.white(channelName)));
        await this.updateVoiceChannels();
        if (this.gameManager && typeof this.gameManager.notifyVoiceChannelUpdate === 'function') {
          this.gameManager.notifyVoiceChannelUpdate();
        }
      }
    } catch (err) {
      console.warn(chalk.red('onChannelCreate handler error'), err?.message || err);
    }
  }

  async onChannelDelete(channel) {
    try {
      if (channel.isVoiceBased?.()) {
        let channelName = 'Unknown';
        if (channel instanceof VoiceChannel || channel instanceof StageChannel) {
          channelName = channel.name;
        }
        console.info(chalk.blueBright("Discord.js"), chalk.yellow("Channel"), chalk.red("Deleted voice channel:", chalk.white(channelName)));
        await this.updateVoiceChannels();
        if (this.gameManager && typeof this.gameManager.notifyVoiceChannelUpdate === 'function') {
          this.gameManager.notifyVoiceChannelUpdate();
        }
      }
    } catch (err) {
      console.warn(chalk.red('onChannelDelete handler error'), err?.message || err);
    }
  }

  async onChannelUpdate(oldChannel, newChannel) {
    try {
      if (oldChannel.isVoiceBased?.() || newChannel.isVoiceBased?.()) {
        let oldName = 'Unknown';
        let newName = 'Unknown';

        if (oldChannel instanceof VoiceChannel || oldChannel instanceof StageChannel) {
          oldName = oldChannel.name;
        }
        if (newChannel instanceof VoiceChannel || newChannel instanceof StageChannel) {
          newName = newChannel.name;
        }

        console.info(chalk.blueBright("Discord.js"), chalk.yellow("Channel"), chalk.green("Updated voice channel:", chalk.white(`${oldName} → ${newName}`)));
        await this.updateVoiceChannels();
        if (this.gameManager && typeof this.gameManager.notifyVoiceChannelUpdate === 'function') {
          this.gameManager.notifyVoiceChannelUpdate();
        }
      }
    } catch (err) {
      console.warn(chalk.red('onChannelUpdate handler error'), err?.message || err);
    }
  }

  async onVoiceStateUpdate(oldState, newState) {
    try {
      if (!this.gameManager || typeof this.gameManager.isUser !== 'function') {
        return; // Game manager not set or not ready
      }

      if (!this.gameManager.isUser(newState.id)) {
        //Only handle voiceStateUpdates for existing users.
        return;
      }

      if (oldState.channel === null && newState.channel !== null) {
        // Someone joining voice
        console.info(chalk.blueBright("Discord.js"), "someone joined voice...", newState.id, newState.channelId);
        if (typeof this.gameManager.handleVoiceStateUpdate === 'function') {
          this.gameManager.handleVoiceStateUpdate(newState.id, newState.channelId);
        }
      } else if (newState.channel === null && oldState.channel !== null) {
        // Someone leaving voice
        console.info(chalk.blueBright("Discord.js"), "someone left voice...", newState.id);
        if (typeof this.gameManager.handleVoiceStateUpdate === 'function') {
          this.gameManager.handleVoiceStateUpdate(newState.id, null);
        }
      } else {
        const oldStatePrivateCall = this.privateCallChannels.find(c => c.id === oldState.channelId);
        const newStatePrivateCall = this.privateCallChannels.find(c => c.id === newState.channelId);

        if (newStatePrivateCall) {
          newStatePrivateCall.inUse = true;

          if (!oldStatePrivateCall) {
            // New Channel is private call, old is not.
            // This means they've left a chat and should go back to that when they leave a private call.
            if (this.gameManager.users?.[newState.id]) {
              this.gameManager.users[newState.id].voiceChannelId = oldState.channelId;
            }
          }

          console.info(chalk.magenta('voiceStateUpdate PCC'), this.privateCallChannels);
        }

        if (oldStatePrivateCall) {
          // Someone has left a privateCallChannel
          const membersSize = oldState.channel && typeof oldState.channel.members !== 'undefined' ? (oldState.channel.members.size ?? (oldState.channel.members?.cache?.size ?? 0)) : 0;
          if (membersSize === 0) {
            oldStatePrivateCall.reserved = false;
            oldStatePrivateCall.inUse = false;
            console.info(chalk.magenta('voiceStateUpdate PCC'), this.privateCallChannels);
          }

          // If the user moved out of a private call into a non-private channel, treat this as leaving the call
          if (!newStatePrivateCall) {
            try {
              if (this.gameManager && this.gameManager.callManager) {
                const user = this.gameManager.users?.[newState.id];
                const socketId = user?.socket?.id;
                if (socketId) {
                  const phones = this.gameManager.phoneManager.getPhonesForDiscordId(newState.id) || [];
                  for (const phone of phones) {
                    for (const call of Array.from(this.gameManager.callManager.activeCalls.values())) {
                      if (call.includesPhone && call.includesPhone(phone)) {
                        // Best-effort leave; don't block the handler
                        void this.gameManager.callManager.leaveCall(socketId, call.id).catch(err => console.warn('Error forcing leaveCall on channel move', err?.message || err));
                      }
                    }
                  }
                }
              }
            } catch (err) {
              console.warn('onVoiceStateUpdate: error forcing leave on channel move', err?.message || err);
            }
          }
        }
      }
    } catch (err) {
      console.warn(chalk.red('onVoiceStateUpdate handler error'), err?.message || err);
    }
  }

  /**
   * Update the cached list of voice channels
   */
  async updateVoiceChannels() {
    const guild = await this.client.guilds.fetch(this.guildId);
    const channels = await guild.channels.fetch();
    const voiceChannels = channels.filter(channel => channel.isVoiceBased());
    
    this.voiceChannels = Array.from(voiceChannels.values()).map(channel => ({
      id: channel.id,
      name: channel.name
    }));
  }

  /**
   * Get the current list of voice channels
   * @returns {Array} List of voice channels with id and name
   */
  getVoiceChannels() {
    return this.voiceChannels;
  }

  async configureVoiceChannels() {
    const guild = await this.client.guilds.fetch(this.guildId);
    const channels = await guild.channels.fetch();
    const voiceChannels = channels.filter(x => x.isVoiceBased());

    const privateCallChannels = voiceChannels.filter(x => x.name?.startsWith(this.prefix));
    this.privateCallChannels = Array.from(privateCallChannels.values())
      .map(vc => ({id: vc.id, reserved: false, inUse: false}));

    for(const channel of Object.keys(this.gameManager.channels)) {
      const staticChannel = voiceChannels.filter(x => x.name === this.gameManager.channels[channel]).first();
      if(staticChannel !== null && typeof staticChannel !== 'undefined') {
        this.gameManager.channels[channel] = staticChannel.id;
      } else {
        console.warn(chalk.red("Static Channel"), channel, chalk.red("does not exist for this Guild"));
      }
    }

    for(const sim of Object.keys(this.gameManager.sims)) {
      if("channel" in this.gameManager.sims[sim]) {
        const simChannel = voiceChannels.filter(x => x.name === this.gameManager.sims[sim].channel).first();
        if(simChannel !== null && typeof simChannel !== 'undefined') {
          this.gameManager.sims[sim].channel = simChannel.id;
        } else {
          console.warn(chalk.red("Channel"), this.gameManager.sims[sim].channel, chalk.red("for sim"), sim, chalk.red("does not exist for this Guild"));
        }
      }
    }

  }

  /**
   * 
   * @param {string} discordId 
   * @returns 
   */
  async getMember(discordId)
  {
    const guild = await this.client.guilds.fetch(this.guildId);
    const member = await guild.members.fetch(discordId);
    return member;
  }


  //get a user voice channel
  //takes a string
  async getUserVoiceChannel(userId)
  {
    let member = await this.getMember(userId);
    if(member)
    {
      if(typeof member.voice !== 'undefined' && member.voice.channel !== null)
      {
        return await member.voice.channel.id;
      }
      else
      {
        console.warn(chalk.red("getUserVoiceChannel"), chalk.yellow("No voice channel:"), chalk.white(userId));
        return null;
      }
    }else{
      console.info(chalk.red("getUserVoiceChannel"), chalk.yellow("No member:"), chalk.white(userId));
      return null;
    }
  }

  /**
 * 
 * @param {string} channel 
 * @returns {import('discord.js').GuildBasedChannel}
 */
  getVoiceChannelByName(channel)
  {
    const guild = this.client.guilds.cache.get(this.guildId);
    const vc = guild.channels.cache.find(chan => chan.name === channel);
    return vc;
  }

  async getVoiceChannelById(channelId)
  {
    const guild = this.client.guilds.cache.get(this.guildId);
    const vc = await guild.channels.fetch(channelId);
    return vc;
  }


  /**
   * 
   * @param {string} discordId 
   * @param {string | null} channelId 
   * @returns {Promise<boolean>}
   */
  async setUserVoiceChannel(discordId, channelId = null)
  {
    const member = await this.getMember(discordId);
    try {
      if(channelId === null) {
        channelId = this.gameManager.users[discordId].voiceChannelId;
      }
      const result = await member.voice.setChannel(channelId).catch((error)=>{
        console.warn(chalk.red("Member is not in a voice channel and cannot be moved (Promise):", discordId),error);
        return false;
      });

      return !(result === false);
    } catch (error) {
      console.warn(chalk.red("Member is not in a voice channel and cannot be moved (Exception):", discordId),JSON.stringify(error, Object.getOwnPropertyNames(error)));
      return false;
    }
    
  }
  /**
   * 
   * @returns {string} channelId;
   */
  getAvailableCallChannel() {
    const channel = this.privateCallChannels.find(c => c.reserved === false && c.inUse === false);
    if (typeof channel === 'undefined') {
      console.error(chalk.red("No available private call rooms:"),this.privateCallChannels);
      return null;
    }
    channel.reserved = true;
    channel.reservedAt = Date.now();
    console.info(chalk.magenta('getAvailableCallChannel PCC'), this.privateCallChannels);
    return channel.id;
  }

  releasePrivateCallChannelReservation(channelId) {
    const channel = this.privateCallChannels.find(c => c.id === channelId && c.reserved === true);
    if(typeof channel !== 'undefined') {
      channel.reserved = false;
      delete channel.reservedAt;
      channel.inUse = false;
    }
  }

  /**
   * Release reserved channels that have been stale (reserved but not in use) longer than ttlMs
   * @param {number} ttlMs - time in milliseconds after which a reserved channel is considered stale
   * @returns {Array<string>} list of channel ids that were released
   */
  releaseStaleReservedChannels(ttlMs = 60000) {
    const now = Date.now();
    const released = [];
    for (const ch of this.privateCallChannels) {
      if (ch.reserved === true && ch.inUse === false && ch.reservedAt && (now - ch.reservedAt) > ttlMs) {
        ch.reserved = false;
        delete ch.reservedAt;
        released.push(ch.id);
        console.info(chalk.magenta('releaseStaleReservedChannels released:'), ch.id);
      }
    }
    return released;
  }

  // TASK-007: Enhanced Channel Request System
  /**
   * Request a voice channel for a group call with priority-based allocation
   * @param {string} callType - Type of call ('REC', 'GROUP', 'EMERGENCY')
   * @param {string} callId - Unique identifier for the group call
   * @param {string} senderId - Discord ID of the call sender
   * @param {Array<string>} participantIds - Array of Discord IDs for participants
   * @param {Object} options - Additional options for channel allocation
   * @returns {Promise<Object|null>} Channel allocation result or null if none available
   */
  async requestCallChannel(callType, callId, senderId, participantIds = [], options = {}) {
    try {
      // Priority mapping: EMERGENCY > REC > GROUP
      const priorityMap = {
        'EMERGENCY': 1,
        'REC': 2, 
        'GROUP': 3
      };

      const priority = priorityMap[callType] || 3;
      
      // Find available channel with priority consideration
      let selectedChannel = null;
      
      // For high priority calls, try to preempt lower priority channels if needed
      if (priority <= 2 && !this._hasAvailableChannel()) {
        selectedChannel = await this._preemptLowerPriorityChannel(priority);
      } else {
        selectedChannel = this._findAvailableChannel();
      }

      if (!selectedChannel) {
        console.warn(chalk.red("No channels available for call:"), callType, callId);
        return null;
      }

      // Reserve channel and track usage
      const channelData = this.privateCallChannels.find(c => c.id === selectedChannel.id);
      if (channelData) {
        channelData.reserved = true;
        channelData.inUse = true;
        channelData.callType = callType;
        channelData.callId = callId;
        channelData.priority = priority;
        channelData.senderId = senderId;
        channelData.participantIds = [...participantIds];
        channelData.startTime = new Date();
        channelData.lastActivity = new Date();
      }

      console.info(chalk.green("Channel allocated:"), callType, callId, selectedChannel.id);
      
      return {
        channelId: selectedChannel.id,
        channelName: selectedChannel.name,
        priority: priority,
        callType: callType,
        callId: callId
      };
      
    } catch (error) {
      console.error(chalk.red("Error requesting call channel:"), error);
      return null;
    }
  }

  // TASK-008: Channel Usage Tracking and Reporting
  /**
   * Get comprehensive usage information for channels
   * @param {string} channelId - Optional specific channel ID to query
   * @returns {Object} Channel usage statistics and current allocations
   */
  getChannelUsageInfo(channelId = null) {
    try {
      if (channelId) {
        // Get info for specific channel
        const channel = this.privateCallChannels.find(c => c.id === channelId);
        if (!channel) {
          return { error: 'Channel not found', channelId };
        }

        return {
          channelId: channel.id,
          status: channel.inUse ? 'IN_USE' : (channel.reserved ? 'RESERVED' : 'AVAILABLE'),
          callType: channel.callType || null,
          callId: channel.callId || null,
          priority: channel.priority || null,
          senderId: channel.senderId || null,
          participantCount: channel.participantIds ? channel.participantIds.length : 0,
          participantIds: channel.participantIds || [],
          startTime: channel.startTime || null,
          lastActivity: channel.lastActivity || null,
          duration: channel.startTime ? Date.now() - channel.startTime.getTime() : null
        };
      } else {
        // Get overview of all channels
        const stats = {
          totalChannels: this.privateCallChannels.length,
          available: 0,
          reserved: 0,
          inUse: 0,
          byType: { REC: 0, GROUP: 0, EMERGENCY: 0 },
          byPriority: { 1: 0, 2: 0, 3: 0 },
          channels: []
        };

        this.privateCallChannels.forEach(channel => {
          if (channel.inUse) {
            stats.inUse++;
            if (channel.callType) stats.byType[channel.callType]++;
            if (channel.priority) stats.byPriority[channel.priority]++;
          } else if (channel.reserved) {
            stats.reserved++;
          } else {
            stats.available++;
          }

          stats.channels.push({
            channelId: channel.id,
            status: channel.inUse ? 'IN_USE' : (channel.reserved ? 'RESERVED' : 'AVAILABLE'),
            callType: channel.callType || null,
            callId: channel.callId || null,
            priority: channel.priority || null,
            participantCount: channel.participantIds ? channel.participantIds.length : 0,
            duration: channel.startTime ? Date.now() - channel.startTime.getTime() : null
          });
        });

        return stats;
      }
    } catch (error) {
      console.error(chalk.red("Error getting channel usage info:"), error);
      return { error: 'Internal error getting channel usage info' };
    }
  }

  // TASK-009: Automated Termination Capabilities  
  /**
   * Terminate a group call and release the associated channel
   * @param {string} channelId - Channel ID to terminate
   * @param {string} requestorId - Discord ID of who is requesting termination
   * @param {string} reason - Reason for termination ('COMPLETED', 'PREEMPTED', 'TIMEOUT', 'ERROR')
   * @returns {Promise<boolean>} Success status
   */
  async terminateCallForChannel(channelId, requestorId = null, reason = 'COMPLETED') {
    try {
      const channel = this.privateCallChannels.find(c => c.id === channelId);
      if (!channel) {
        console.warn(chalk.yellow("Terminate call - channel not found:"), channelId);
        return false;
      }

      if (!channel.inUse && !channel.reserved) {
        console.warn(chalk.yellow("Terminate call - channel not in use:"), channelId);
        return false;
      }

      // Validate termination authority
      if (requestorId && channel.senderId && requestorId !== channel.senderId) {
        // Only sender or system can terminate (unless emergency preemption)
        if (reason !== 'PREEMPTED' && reason !== 'TIMEOUT') {
          console.warn(chalk.yellow("Terminate call - unauthorized:"), requestorId, "not sender:", channel.senderId);
          return false;
        }
      }

      // Get Discord voice channel to move users out
      const discordChannel = await this.getVoiceChannelById(channelId);
      if (discordChannel && discordChannel.members) {
        // Move all users back to their original channels or default  
        const members = discordChannel.members instanceof Map ? 
          Array.from(discordChannel.members.values()) : 
          Array.from(discordChannel.members.cache.values());
        const movePromises = members.map(async (member) => {
          try {
            const playerId = member.id;
            const originalChannel = this.gameManager.users[playerId]?.voiceChannelId;
            
            if (originalChannel && originalChannel !== channelId) {
              await member.voice.setChannel(originalChannel);
              console.info(chalk.blue("Moved user back to original channel:"), playerId, originalChannel);
            } else {
              // Move to default channel or disconnect
              await member.voice.setChannel(null);
              console.info(chalk.blue("Disconnected user from terminated channel:"), playerId);
            }
          } catch (error) {
            console.warn(chalk.yellow("Failed to move user during termination:"), member.id, error.message);
          }
        });

        await Promise.allSettled(movePromises);
      }

      // Release channel and clear metadata
      const callId = channel.callId;
      const callType = channel.callType;
      
      channel.reserved = false;
      channel.inUse = false;
      delete channel.callType;
      delete channel.callId;
      delete channel.priority;
      delete channel.senderId;
      delete channel.participantIds;
      delete channel.startTime;
      delete channel.lastActivity;

      console.info(chalk.green("Channel terminated:"), callType, callId, channelId, "Reason:", reason);
      
      // Notify game manager of termination (if method exists)
      if (this.gameManager && 'handleChannelTermination' in this.gameManager) {
        // @ts-ignore - Optional method for enhanced channel management
        this.gameManager.handleChannelTermination(channelId, callId, reason);
      }

      return true;
      
    } catch (error) {
      console.error(chalk.red("Error terminating call for channel:"), channelId, error);
      return false;
    }
  }

  // TASK-010: Priority-based Allocation Logic (Helper Methods)
  /**
   * Check if any channels are available
   * @returns {boolean}
   * @private
   */
  _hasAvailableChannel() {
    return this.privateCallChannels.some(c => !c.reserved && !c.inUse);
  }

  /**
   * Find an available channel
   * @returns {Object|null}
   * @private
   */
  _findAvailableChannel() {
    const availableChannel = this.privateCallChannels.find(c => !c.reserved && !c.inUse);
    return availableChannel ? { id: availableChannel.id, name: `Channel-${availableChannel.id}` } : null;
  }

  /**
   * Preempt a lower priority channel for higher priority call
   * @param {number} requestPriority - Priority of the requesting call
   * @returns {Promise<Object|null>}
   * @private
   */
  async _preemptLowerPriorityChannel(requestPriority) {
    try {
      // Find channels with lower priority (higher number)
      const preemptableChannels = this.privateCallChannels
        .filter(c => c.inUse && c.priority > requestPriority)
        .sort((a, b) => b.priority - a.priority); // Lowest priority first

      if (preemptableChannels.length === 0) {
        return null;
      }

      const channelToPreempt = preemptableChannels[0];
      console.warn(chalk.yellow("Preempting lower priority call:"), 
        channelToPreempt.callType, channelToPreempt.callId, 
        "Priority:", channelToPreempt.priority, "for priority:", requestPriority);

      // Terminate the existing call
      await this.terminateCallForChannel(channelToPreempt.id, null, 'PREEMPTED');

      return { id: channelToPreempt.id, name: `Channel-${channelToPreempt.id}` };
      
    } catch (error) {
      console.error(chalk.red("Error during channel preemption:"), error);
      return null;
    }
  }

  /**
   * Update channel activity timestamp
   * @param {string} channelId - Channel to update
   */
  updateChannelActivity(channelId) {
    const channel = this.privateCallChannels.find(c => c.id === channelId);
    if (channel && channel.inUse) {
      channel.lastActivity = new Date();
    }
  }

  /**
   * Get channels that have been inactive for specified duration
   * @param {number} timeoutMs - Timeout in milliseconds
   * @returns {Array} List of inactive channels
   */
  getInactiveChannels(timeoutMs = 300000) { // Default 5 minutes
    const now = Date.now();
    return this.privateCallChannels
      .filter(c => c.inUse && c.lastActivity && (now - c.lastActivity.getTime()) > timeoutMs)
      .map(c => ({
        channelId: c.id,
        callId: c.callId,
        callType: c.callType,
        inactiveDuration: now - c.lastActivity.getTime(),
        senderId: c.senderId
      }));
  }
}