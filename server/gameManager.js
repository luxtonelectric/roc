// Begin Better logger
const chalk = require('chalk');
require('better-logging')(console, {
  format: ctx => `${ctx.date}${ctx.time24}${ctx.type}${ctx.STAMP('ROCManager.js', chalk.blueBright)} ${ctx.msg}`
});
// End Better Logger


const { ReactionUserManager } = require('discord.js');
let Player = require('./player');


class GameManager {
  players = new Map();
  privateCalls = {"priv-1": [], "priv-2": []};
  constructor(sockets, bot, config) {
    this.sockets = sockets;
    this.bot = bot;
    this.guild = config.guild;
    this.channels = config.channels;
    this.sims = config.sims;
  }


  //takes player object
  addPlayer(player)
  {
    if(/^((.{2,32})#\d{4})$/.test(player.discordID)) //arturs did this and its fuck'd
    {
      var channel = this.bot.getUserVoiceChannel(player.discordID);
      if(channel)
      {
        if(channel === this.channels.lobby)
        {
          this.players.set(player.discordID, player);
          this.sockets.to(player.socket.id).emit("loggedIn", {"loggedIn":true, "error": ""});
          this.sockets.emit("gameInfo", this.getGameState());
        }
        else
        {
          this.sockets.to(player.socket.id).emit("loggedIn", {"loggedIn":false, "error": `You aren't in the lobby. Please join ${this.channels.lobby} to join the game.`});
        }
      }
      else
      {
        this.sockets.to(player.socket.id).emit("loggedIn", {"loggedIn":false, "error": "You aren't in a voice chat.."});
        return false;
      }
    }
    else
    {
      this.sockets.to(player.socket.id).emit("loggedIn", {"loggedIn":false, "error": "That isn't a discord username."});
    }
    // this.getPlayerLocation(player);
  }
  
  getPlayer(player)
  {
    return this.players[player.discordID];
  }


//get all the player locations
//returns an array
  getAllPlayerLocs()
  {
    var locations = {};
    for (let sim = 0; sim < this.sims.length; sim++) {
      const element = this.sims[sim];
      locations[element] = [];
    }
    // console.log(locations);
    // console.log("60", this.players.entries());
    for(const [key, value] of this.players.entries())
    {
      var loc = this.getPlayerLocation(value);

      if (!locations[loc]){ locations[loc] = [];}

      var obj = {discordID: value.discordID, panel: value.panel};
      
      // console.log("LN65", obj);

      if(!locations[loc][obj])
      {
        locations[loc].push(obj);
        // console.log("69", locations[loc]);
      }
    }
    return locations;
  }

  //takes player object in
  //returns string
  getPlayerLocation(player)
  {
//come back here
    var yes = getKeyByValue(this.channels, this.bot.getUserVoiceChannel(player.discordID)); //this does stuff
    // <3 arturs
    // if(yes.includes("sim-"))
    // {
    //   yes = this.sims[yes];
    // }
    return yes;
  }

  //takes nothing
  //returns object of game state
  getGameState()
  {
    var obj = [];
    var playerLocs = this.getAllPlayerLocs();
    var channels = this.channels;
    var sims = this.sims;
    Object.keys(this.channels).forEach(key => {
      var chan = channels[key];
      
      obj.push({
        players: playerLocs[key],
        id: chan,
        name: sims[getKeyByValue(channels,chan)]
      });
    });
    return obj;
  }

  placeCall(data)
  {
    var p = this.players.get(data.sender);
    console.log(chalk.blueBright("GameManager"), chalk.yellow("Placing Call"), chalk.magenta("Length:"), this.privateCalls['priv-1'].length);
    if(this.privateCalls['priv-1'].length < 1)
    {
      this.privateCalls['priv-1'] = [data.user, data.sender];
      this.fullyPlaceCall(data, 0);
    }
    else if(this.privateCalls['priv-2'] < 1)
    {
      this.privateCalls['priv-2'] = [data.user, data.sender];
      this.fullyPlaceCall(data, 1);
    }
    else
    {
      this.sockets.to(p.socket.id).emit('rejectCall', {"success":false})
    }
  }

  fullyPlaceCall(data, channel)
  {
    var p = this.players.get(data.user);
    this.sockets.to(p.socket.id).emit("incomingCall", {"user":data.sender, "panel": data.senderpanel, "sim": data.sendersim, "channel": channel});
  }

  rejectCall(data)
  {
    var p = this.players.get(data.user);
    console.log(chalk.blueBright("GameManager"), chalk.yellow("Reject Call"), chalk.magenta("Priv Call Data:"), data);
    for(var call in this.privateCalls)
    {
      if(this.privateCalls[call] != null || this.privateCalls[call] != [])
      {
        if(this.privateCalls[call].indexOf(data.user)>-1)
        {
          // console.log(this.privateCalls[call]);
          var index = this.privateCalls[call].indexOf(data.user);
          if (index !== -1) {
            this.privateCalls[call] = [];
          }
        }
      }
    }
    console.log(chalk.blueBright("GameManager"), chalk.yellow("Reject Call"), chalk.magenta("Priv Call:"), this.privateCalls, data.channel);
    this.sockets.to(p.socket.id).emit("rejectCall", {"success":false});
  }

  leaveCall(data)
  {
    console.log(chalk.blueBright("GameManager"), chalk.yellow("Leave Call"), chalk.magenta("Before:"), this.privateCalls);
    
    for(var call in this.privateCalls)
    {
      if(this.privateCalls[call] != null || this.privateCalls[call] != [])
      {
        if(this.privateCalls[call].indexOf(data.user)>-1)
        {
          // console.log(this.privateCalls[call]);
          var index = this.privateCalls[call].indexOf(data.user);
          if (index !== -1) {
            this.privateCalls[call].splice(index, 1);
          }
          this.movePlayerToSim(data.user, data.sim);
        }
      }
    }
    console.log(chalk.blueBright("GameManager"), chalk.yellow("Leave Call"), chalk.magenta("Priv Call:"), this.privateCalls);
  }

  acceptCall(data, channel)
  {
    console.log(chalk.blueBright("GameManager"), chalk.yellow("Accept Call"), chalk.magenta("Incoming Data"), data);
    data.users.forEach((d) =>{
      var p = this.players.get(d);
      // console.log(chalk.blueBright("GameManager"), chalk.yellow("Accept Call"), chalk.magenta("Player Object"), p);
      // this.bot.setUserVoiceChannel(p);
      switch(channel)
      {
        case 0:
          this.movePlayerToSim(p.discordID, this.sims["priv-1"]);
          break;
        case 1:
          this.movePlayerToSim(p.discordID, this.sims["priv-2"]);
          break;
        default:
          this.sockets.to(p.socket.id).emit("rejectCall", {"success":false});
          break;
      }
    });
  }

  //force all player uis to update
  updatePlayerUI()
  {
    this.sockets.emit("gameInfo", this.getGameState());
  }

  //update players panel
  //takes in a player string and panel
  updatePlayerPanel(player, panel)
  {
    var p = this.players.get(player);
    p.panel = panel;
    this.players.set(player, p);
    this.updatePlayerUI();
  }

  //strings in
  movePlayerToSim(player, sim)
  {
    this.bot.setUserVoiceChannel(player, this.channels[getKeyByValue(this.sims, sim)]);
  }


  //obj and strings
  playerJoinREC(player)
  {
    console.log(chalk.blueBright("GameManager"), chalk.yellow("Player joining REC:"), chalk.white(player));
    this.acceptCall({users:[player]}, 1);
  }

  //takes socket msg in
  playerStartREC(data)
  {
    console.log(chalk.blueBright("GameManager"), chalk.yellow("playerStartREC"), chalk.magenta("REC started by:"), data.user);
    var gs = this.getGameState();
    this.privateCalls['priv-2'].push(data.user);
    this.playerJoinREC(data.user);
    gs.forEach(el => {
      if(el.name === data.panel)
      {
        if(el.players != null)
        {
          el.players.forEach(p => {
            if(p.discordID != data.user)
            {
              console.log(chalk.blueBright("playerStartREC"), chalk.yellow("el.players foreach"), chalk.white(), p);
              var player = this.players.get(p.discordID);
              this.privateCalls['priv-2'].push(p.discordID);
              this.sockets.to(player.socket.id).emit('incomingREC');
            }
          });
        }
      }
    });
  }

  deletePlayer(data)
  {
    console.log(chalk.blueBright("GameManager"), chalk.yellow("Deleting Player"), chalk.magenta("Socket:"), data);
    for(var [key, value] of this.players.entries())
    {
      if(value.socket.id === data)
      {
        this.players.delete(key);
      }
    }
    this.updatePlayerUI();
  }

}

module.exports = GameManager;


function getKeyByValue(object, value) {
  return Object.keys(object).find(key => object[key] === value);
}