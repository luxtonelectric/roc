import chalk from 'chalk';
import betterLogging from 'better-logging';
betterLogging(console,{
  format: ctx => `${ctx.date}${ctx.time24}${ctx.type}${ctx.STAMP('bot.js', chalk.blueBright)} ${ctx.msg}`
});
import {Client, GatewayIntentBits} from 'discord.js';


export default class DiscordBot {
  constructor (token, prefix, guildId)
  {
    this.client = new Client({intents:[GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates, GatewayIntentBits.GuildPresences]});
    this.token = token;
    this.prefix = prefix;
    this.guildId = guildId;
    this.gameManager = null;
    this.setUpBot();
  }

  setGameManager(gameManager)
  {
    this.gameManager = gameManager;
  }

  setUpBot()
  {
    this.client.on('ready', () => {
      console.info(chalk.blueBright("Discord.js"), chalk.yellow("Ready"), chalk.green("Logged in as:", chalk.white(this.client.user.tag)));
    });
    
    this.client.on('message', msg => {
      if (msg.content === `${this.prefix}ping`) {
        msg.reply('Pong!');
      }
    });
    this.client.login(this.token).then((v) =>{console.info(chalk.blueBright("Discord.js"), chalk.yellow("Login"), chalk.green("Login Successful!"))}).catch((x)=>{console.error(chalk.blueBright("Discord.js"), chalk.yellow("Login"), chalk.red("Login Error"), x.toString())});
  }

  async getMember(userId)
  {
    const guild = await this.client.guilds.fetch(this.guildId);
    const member = await guild.members.fetch(userId);
    return member;
  }


  //get a user voice channel
  //takes a string
  async getUserVoiceChannel(user)
  {
    let member = await this.getMember(user);
    if(member)
    {
      if(member.voice.channel)
      {
        return await member.voice.channel.name.toString();
      }
      else
      {
        console.warn(chalk.red("getUserVoiceChannel"), chalk.yellow("No voice channel:"), chalk.white(user));
        return null;
      }
    }else{
      console.info(chalk.red("getUserVoiceChannel"), chalk.yellow("No member:"), chalk.white(user));
      return null;
    }
  }

  //string in 
  //vc out
  getVoiceChannel(channel)
  {
    let guild = this.client.guilds.cache.get(this.guildId);
    let vc = guild.channels.cache.find(chan => chan.name === channel);
    return vc;
  }


  //strings in
  async setUserVoiceChannel(user, channel)
  {
    var member = this.getMember(user);
    var c  = this.getVoiceChannel(channel)
    try {
      const mem = await member.voice.setChannel(c).catch((error)=>{
        console.warn(chalk.red("Member is not in a voice channel and cannot be moved (Promise):", user),error);
        return false;
      });

      return true;
    } catch (error) {
      console.warn(chalk.red("Member is not in a voice channel and cannot be moved (Exception):", user),error);
      return false;
    }
    
  }
}