import chalk from 'chalk';
import betterLogging from 'better-logging';
betterLogging(console,{
  format: ctx => `${ctx.date}${ctx.time24}${ctx.type}${ctx.STAMP('bot.js', chalk.blueBright)} ${ctx.msg}`
});
import {Client, GatewayIntentBits} from 'discord.js';


export default class DiscordBot {
  constructor (token, prefix, guildId)
  {
    this.client = new Client({intents:[GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.GuildMembers, GatewayIntentBits.GuildVoiceStates, GatewayIntentBits.GuildPresences]});
    this.token = token;
    this.prefix = prefix;
    this.guildId = guildId;
    this.gameManager = null;
  }

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
      console.log(oldState,newState);
      if(oldState.channel === null && newState.channel !== null) {
        // This is a someone joining voice...
        console.info(chalk.blueBright("Discord.js"), "someone joined voice...",newState.id, newState.channelId);
        this.gameManager.registerDiscordVoice(newState.id, newState.channelId);
      }

      if(newState.channel === null && oldState.channel !== null) {
        // This is someone leaving voice...
        console.info(chalk.blueBright("Discord.js"), "someone left voice...", newState.id);
        this.gameManager.unregisterDiscordVoice(newState.id);
      }
    }); 


    await this.client.login(this.token).then((v) =>{console.info(chalk.blueBright("Discord.js"), chalk.yellow("Login"), chalk.green("Login Successful!"))}).catch((x)=>{console.error(chalk.blueBright("Discord.js"), chalk.yellow("Login"), chalk.red("Login Error"), x.toString())});
  }

  async configureVoiceChannels() {
    console.log(chalk.yellow('configureVoiceChannels'));
    const guild = await this.client.guilds.fetch(this.guildId);
    const channels = await guild.channels.fetch();
    const voiceChannels = channels.filter(x => x.isVoiceBased());

    const privateCallChannels = voiceChannels.filter(x => x.name.startsWith(this.prefix));
    for (const vc of privateCallChannels.values()){
      this.gameManager.privateCalls[vc.id] = [];
    }

    for(const sim of Object.keys(this.gameManager.sims)) {
      if("channel" in this.gameManager.sims[sim]) {
        const simChannel = voiceChannels.filter(x => x.name === this.gameManager.sims[sim].channel).first();
        if(simChannel !== null && typeof simChannel !== 'undefined') {
          this.gameManager.sims[sim].channel = simChannel.id;
        } else {
          console.warn(chalk.red("Channel"), this.gameManager.sims[sim].channel, chalk.red("for sim"), key, chalk.red("does not exist for this Guild"));
        }
      }
    }

  }

  async getMember(userId)
  {
    const guild = await this.client.guilds.fetch(this.guildId);
    const member = await guild.members.fetch(userId);
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
        return await member.voice.channel.name.toString();
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

  //string in 
  //vc out
  getVoiceChannelByName(channel)
  {
    let guild = this.client.guilds.cache.get(this.guildId);
    let vc = guild.channels.cache.find(chan => chan.name === channel);
    return vc;
  }

  async getVoiceChannelById(channelId)
  {
    const guild = this.client.guilds.cache.get(this.guildId);
    const vc = await guild.channels.fetch(channelId);
    return vc;
  }


  //strings in
  async setUserVoiceChannel(user, channelId)
  {
    const member = await this.getMember(user);
    try {
      const mem = await member.voice.setChannel(channelId).catch((error)=>{
        console.warn(chalk.red("Member is not in a voice channel and cannot be moved (Promise):", user),error);
        return false;
      });

      return true;
    } catch (error) {
      console.warn(chalk.red("Member is not in a voice channel and cannot be moved (Exception):", user),JSON.stringify(error, Object.getOwnPropertyNames(error)));
      return false;
    }
    
  }
}