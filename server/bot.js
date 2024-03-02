// Begin Better logger
const chalk = require('chalk');
require('better-logging')(console, {
  format: ctx => `${ctx.time24} ${ctx.time12} ${ctx.date} ${ctx.type} ${ctx.STAMP('DiscordBot', chalk.blueBright)} ${ctx.msg}`
});
// End Better Logger

  const {Client, GatewayIntentBits} = require('discord.js');


class DiscordBot {
  constructor (token, prefix, guild)
  {
    this.client = new Client({intents:[GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates, GatewayIntentBits.GuildPresences]});
    this.token = token;
    this.prefix = prefix;
    this.guild = guild;
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

  getMember(user)
  {
    let guild = this.client.guilds.cache.get(this.guild);
    let member = guild.members.cache.find(us=> us.displayName===user);
    return member;
  }


  //get a user voice channel
  //takes a string
  getUserVoiceChannel(user)
  {
    let member = this.getMember(user);
    if(member)
    {
      if(member.voice.channel)
      {
        return member.voice.channel.name.toString();
      }
      else
      {
        console.warn(chalk.red("getUserVoiceChannel"), chalk.yellow("No voice channel:"), chalk.white(user));
        return false;
      }
    }else{
      console.info(chalk.red("getUserVoiceChannel"), chalk.yellow("No member:"), chalk.white(user));
      return false;
    }
  }

  //string in 
  //vc out
  getVoiceChannel(channel)
  {
    let guild = this.client.guilds.cache.get(this.guild);
    let vc = guild.channels.cache.find(chan => chan.name === channel);
    return vc;
  }


  //strings in
  setUserVoiceChannel(user, channel)
  {
    var member = this.getMember(user);
    var c  = this.getVoiceChannel(channel)
    try {
      member.voice.setChannel(c).then(()=>{
      this.gameManager.updatePlayerUI();
    }).catch((error)=>{
      console.warn(chalk.red("Member is not in a voice channel and cannot be moved:", user),error);
    });
    } catch (error) {
      console.warn(chalk.red("Member is not in a voice channel and cannot be moved:", user),error);
    }
    
  }
}


  
module.exports = DiscordBot;