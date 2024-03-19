// @ts-check
import chalk from 'chalk';

import {Client, GatewayIntentBits} from 'discord.js';
import ROCManager from './ROCManager.js';


export default class DiscordBot {
  /** @type {ROCManager} */
  gameManager;

  /** @type {Array} */
  privateCallChannels = [];

  constructor (token, prefix, guildId)
  {
    this.client = new Client({intents:[GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.GuildMembers, GatewayIntentBits.GuildVoiceStates, GatewayIntentBits.GuildPresences]});
    this.token = token;
    this.prefix = prefix;
    this.guildId = guildId;
    this.gameManager = null;
  }
  
  /**
   * 
   * @param {ROCManager} gameManager 
   */
  setGameManager(gameManager)
  {
    this.gameManager = gameManager;
  }

  async setUpBot()
  {
    this.client.on('ready', () => {
      console.info(chalk.blueBright("Discord.js"), chalk.yellow("Ready"), chalk.green("Logged in as:", chalk.white(this.client.user.tag)));
    });
    
    this.client.on('message', msg => {
      if (msg.content === `${this.prefix}ping`) {
        msg.reply('Pong!');
      }
    });

    this.client.on('voiceStateUpdate', (oldState, newState) => {
      
      if(typeof this.gameManager.players[newState.id] === 'undefined') {
        //Only handle voiceStateUpdates for player.
        return;
      }
      if(oldState.channel === null && newState.channel !== null) {
        // This is a someone joining voice...
        console.info(chalk.blueBright("Discord.js"), "someone joined voice...",newState.id, newState.channelId);
        this.gameManager.registerDiscordVoice(newState.id, newState.channelId);
      } else if(newState.channel === null && oldState.channel !== null) {
        // This is someone leaving voice...
        console.info(chalk.blueBright("Discord.js"), "someone left voice...", newState.id);
        this.gameManager.unregisterDiscordVoice(newState.id);
      } else{
        const oldStatePrivateCall = this.privateCallChannels.find(c => c.id === oldState.channelId);
        const newStatePrivateCall = this.privateCallChannels.find(c => c.id === newState.channelId);
        
        if(newStatePrivateCall) {
          newStatePrivateCall.inUse = true;

          if(!(oldStatePrivateCall)) {
            // New Channel is private call, old is not.
            // This means they've left a chat and should go back to that when they leave a private call.
            this.gameManager.players[newState.id].voiceChannelId = oldState.channelId;
          }

          console.info(chalk.magenta('voiceStateUpdate PCC'), this.privateCallChannels);
        }
        
        if(oldStatePrivateCall) {
          // Someone has left a privateCallChannel
          if(oldState.channel.members.size === 0) {
            oldStatePrivateCall.reserved = false;
            oldStatePrivateCall.inUse = false;
            console.info(chalk.magenta('voiceStateUpdate PCC'), this.privateCallChannels);
          }
        }
      } 

    }); 

    await this.client.login(this.token).then((v) =>{console.info(chalk.blueBright("Discord.js"), chalk.yellow("Login"), chalk.green("Login Successful!"))}).catch((x)=>{console.error(chalk.blueBright("Discord.js"), chalk.yellow("Login"), chalk.red("Login Error"), x.toString())});
  }

  async configureVoiceChannels() {
    const guild = await this.client.guilds.fetch(this.guildId);
    const channels = await guild.channels.fetch();
    const voiceChannels = channels.filter(x => x.isVoiceBased());

    const privateCallChannels = voiceChannels.filter(x => x.name.startsWith(this.prefix));
    for (const vc of privateCallChannels.values()){
      this.privateCallChannels.push({id:vc.id, reserved:false, inUse:false});
    }

    for(const channel of Object.keys(this.gameManager.channels)) {
      const staticChannel = voiceChannels.filter(x => x.name === this.gameManager.channels[channel]).first();
      if(staticChannel !== null && typeof staticChannel !== 'undefined') {
        this.gameManager.channels[channel] = staticChannel.id;
      } else {
        console.warn(chalk.red("Static Channel"), channel, chalk.red("does not exist for this Guild"));
      }
    }
    console.log(chalk.yellow('configureVoiceChannels'), this.gameManager.channels);

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
   * @returns 
   */
  async setUserVoiceChannel(discordId, channelId = null)
  {
    const member = await this.getMember(discordId);
    try {
      if(channelId === null) {
        channelId = this.gameManager.players[discordId].voiceChannelId;
      }
      const mem = await member.voice.setChannel(channelId).catch((error)=>{
        console.warn(chalk.red("Member is not in a voice channel and cannot be moved (Promise):", discordId),error);
        return false;
      });

      return true;
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
    console.info(chalk.magenta('getAvailableCallChannel PCC'), this.privateCallChannels);
    return channel.id;
  }

  releasePrivateCallChannelReservation(channelId) {
    const channel = this.privateCallChannels.find(c => c.id === channelId && c.reserved === true);
    if(typeof channel !== 'undefined') {
      channel.reserved = false;
    }
    console.info(chalk.magenta('releasePrivateCallChannelReservation PCC'), this.privateCallChannels);
  }
}