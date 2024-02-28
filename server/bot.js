// Begin Better logger
const chalk = require('chalk');
require('better-logging')(console, {
  format: ctx => `${ctx.time24} ${ctx.time12} ${ctx.date} ${ctx.type} ${ctx.STAMP('DiscordBot', chalk.blueBright)} ${ctx.msg}`
});
// End Better Logger

const Discord = require('discord.js');


class DiscordBot {
  constructor (token, prefix, guild)
  {
    this.client = new Discord.Client();
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
    let member = guild.members.cache.find(us=> us.user.username===user.split("#")[0]);
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
        return false;
      }
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
    member.voice.setChannel(c).then(()=>{
      this.gameManager.updatePlayerUI();
    });
  }
}


  
module.exports = DiscordBot;