// Begin Better logger
const chalk = require('chalk');
require('better-logging')(console, {
  format: ctx => `${ctx.date}${ctx.time24}${ctx.type}${ctx.STAMP('ROCManager.js', chalk.blueBright)} ${ctx.msg}`
});
// End Better Logger

/*

Log info:
console.info(chalk.yellow("FuncHere()"), "Message Here");

*/

const {
  ReactionUserManager
} = require('discord.js');
let Player = require('./player');


class ROCManager {
  players = {};
  admins = {};
  privateCalls;
  constructor(sockets, bot, config) {
    this.sockets = sockets;
    this.bot = bot;
    this.guild = config.guild;
    this.channels = config.channels;
    this.sims = config.sims;
    this.config = config;
    this.privateCalls = config.privateCalls;
    console.info(chalk.yellow("constructor"), `Welcome! Yum yum!`);
  }
  
  
  // ============================= BEGIN PLAYER SHIT =============================


  //takes player object
  addPlayer(player) {
    console.info(chalk.yellow("AddPlayer"), "New Player Joining");
    if (/^((.{2,32}))$/.test(player.discordID))
    {
      var channel = this.bot.getUserVoiceChannel(player.discordID);
      if (channel) {
        console.info(chalk.yellow("AddPlayer"), `User ${player.discordID} is in a voice channel:`, chalk.magentaBright(channel));
        if (channel === this.channels.lobby) {
          console.info(chalk.yellow("AddPlayer"), `User ${player.discordID} is in lobby channel`);
          player.sim = "lobby";
          this.players[player.discordID] = player;
          // this.players[player.discordID].inCall = true;
          // console.info(this.players);
          this.sockets.to(player.socket.id).emit("loggedIn", {
            "loggedIn": true,
            "error": ""
          });
          this.sockets.emit("gameInfo", this.getGameState());
          this.updatePlayerUI();
        } else {
          console.info(chalk.yellow("AddPlayer"), `User ${player.discordID} is not in the lobby.`);
          this.sockets.to(player.socket.id).emit("loggedIn", {
            "loggedIn": false,
            "error": `You aren't in the lobby. Please join ${this.channels.lobby} to join the game.`
          });
        }
      } else {
        console.info(chalk.yellow("AddPlayer"), `User ${player.discordID} is not in a voice channel:`);
        this.sockets.to(player.socket.id).emit("loggedIn", {
          "loggedIn": false,
          "error": "You aren't in a voice chat.."
        });
        return false;
      }
    } else {
      console.info(chalk.yellow("AddPlayer"), `User ${player.discordID} is not a discord username. What?`);
      this.sockets.to(player.socket.id).emit("loggedIn", {
        "loggedIn": false,
        "error": "That isn't a discord username."
      });
    }
  }

  updatePlayerPanel(user, panel)
  {
    this.players[user].panel = panel;
    this.updatePlayerUI();
  }

  //take in a player's name
  deletePlayer(player)
  {
    console.info("Player wishes to leave:", player);
    for(var [key, value] of Object.entries(this.players))
    {
      if(value.socket.id === player)
      {
        delete this.players[key];
      }
    }
    this.updatePlayerUI();
  }


  // ============================== END PLAYER SHIT ==============================

  // ============================== BEGIN CALL SHIT ==============================


  // take in an object with sender and reciever
  placeCall(data)
  {
    // console.log(data);
    var caller = this.players[data.sender];
    var reciever = this.players[data.user];

    if(caller !== reciever) {
      console.info(chalk.yellow("Placing Call"), chalk.magentaBright("Caller:"), caller.discordID, chalk.magentaBright("Reciever:"), reciever.discordID);
      reciever.callQueue[caller.discordID] = {"discordID": caller.discordID, "panel": caller.panel, "sim": data.sendersim, "timePlaced": Date.now()};
      console.log(chalk.yellow("Queue for"), reciever.discordID, reciever.callQueue);
      reciever.socket.emit("newCallInQueue", reciever.callQueue);
      this.players[data.user] = reciever;
      this.updatePlayerUI();
    } else {
      console.log(chalk.yellow("A player ("), caller.discordID, chalk.yellow(")tried to call themselves as was rejected."));
      this.sockets.to(this.players[data.sender].socket.id).emit('rejectCall', {"success":false})
    }
  }

  getAvailableCallChannel() {
    //let channel = null;
    //const keys = Object.keys(this.privateCalls);
    for(const key in this.privateCalls) {
      if(this.privateCalls[key].length == 0) {
        return key;
      }
    }
    console.log(chalk.red("No available call channels:"),this.privateCalls);
    return null;
  }

  acceptCall(data)
  {
    // this.players[data.user].callQueue[data.sender];
    if(this.players[data.sender].inCall === false)
    {
      var p = this.players[data.sender];
      const available = this.getAvailableCallChannel();
      
      if(available !== null) {
        console.log(chalk.blueBright("GameManager"), chalk.yellow("Join Call"), chalk.magenta("Length:"), this.privateCalls[available].length);
        this.privateCalls[available] = [data.user, data.sender];
        this.joinCall(data, available);
      } else {
        this.sockets.to(p.socket.id).emit('rejectCall', {"success":false})
      }
    }
    else
    {
      this.sockets.to(this.players[data.sender].socket.id).emit('rejectCall', {"success":false})
    }
  }

  rejectCall(data)
  {
    delete this.players[data.user].callQueue[data.sender];
    this.sockets.to(this.players[data.sender].socket.id).emit("rejectCall",{"success": false});
    this.sockets.to(this.players[data.user].socket.id).emit('updateMyCalls', this.players[data.user].callQueue);
    this.updatePlayerUI();
  }

  joinCall(data, channel)
  {
    var success = false;
    console.log(chalk.blueBright("GameManager"), chalk.yellow("Join Call"), chalk.magenta("Incoming Data"), data);
    data.users.forEach((d) =>{
      var p = this.players[d];
      this.movePlayerToCall(p.discordID, channel);
      success = true;
      this.sockets.to(p.socket.id).emit("joinedCall",{"success":true});

      if(success === true)
      {
        this.players[data.user].inCall = true;
        this.players[data.sender].inCall = true;
        delete this.players[data.user].callQueue[data.sender];
        this.sockets.to(this.players[data.user].socket.id).emit('updateMyCalls', this.players[data.user].callQueue);
      }
      else
      {
        console.log("shit");
      }
      this.updatePlayerUI();
    });
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
          var index = this.privateCalls[call].indexOf(data.user);
          if (index !== -1) {
            this.privateCalls[call].splice(index, 1);
            this.players[data.user].inCall = false;
          }
          //console.log(this.players[data.user]);
          //TODO: What do we replace these calls with?
          this.movePlayerToSim(data.user, this.players[data.user].sim);

          if(this.privateCalls[call].length == 1) {
            const caller = this.privateCalls[call][0];
            this.players[caller].inCall = false;
            this.movePlayerToSim(caller, this.players[caller].sim);
            this.sockets.to(this.players[caller].socket.id).emit("kickedFromCall", {"success": true});
          }
        }
      }
    }
    console.log(chalk.blueBright("GameManager"), chalk.yellow("Leave Call"), chalk.magenta("Priv Call:"), this.privateCalls);
  }


  // =============================== END CALL SHIT ===============================

// REc
 //obj and strings
 playerJoinREC(playerId, channelId)
 {
   console.log(chalk.blueBright("GameManager"), chalk.yellow("Player joining REC:"), chalk.white(playerId));
  //  this.acceptCall({users:[player]}, 1);
  this.movePlayerToCall(playerId, channelId);
  this.sockets.to(this.players[playerId].socket.id).emit("joinedCall",{"success":true});
 }

playerStartREC(data)
  {
    console.log(chalk.blueBright("GameManager"), chalk.yellow("playerStartREC"), chalk.magenta("REC started by:"), data.user);
    var gs = this.getGameState();
    const available = this.getAvailableCallChannel();
    if(available !== null) {
      this.privateCalls[available].push(data.user);
      this.playerJoinREC(data.user,available);
      gs.forEach(el => {``
        console.log(el.name, data.panel)
        if(el.name === data.panel)
        {
          if(el.players != null)
          {
            el.players.forEach(p => {
              if(p.discordID != data.user)
              {
                console.log(chalk.blueBright("playerStartREC"), chalk.yellow("el.players foreach"), chalk.white(), p);
                var player = this.players[p.discordID];
                this.privateCalls[available].push(p.discordID);
                this.sockets.to(player.socket.id).emit('incomingREC',{"channel":available});
              }
            });
          }
        }
      });
    } else {
      console.log(chalk.red("REC Failed due to no available call channels"))
    }
    
  }

// end REC





  getAllPlayerLocs()
  {
    var locations = {};
    for (let sim = 0; sim < this.sims.length; sim++) {
      const element = this.sims[sim];
      locations[element] = [];
    }
    for(const [key, value] of Object.entries(this.players))
    {
      var loc = this.getPlayerSim(value);
      if (!locations[loc]){ locations[loc] = [];}
      var player = {discordID: value.discordID, panel: value.panel, inCall: value.inCall, callQueue: value.callQueue};
      if(!locations[loc][player])
      {
        locations[loc].push(player);
      }
    }
    return locations;
  }

  // Take in a player object.
  // return their location
  getPlayerSim(player)
  {
    const expectedSim = this.players[player.discordID].sim;
    const playerChannel = this.bot.getUserVoiceChannel(player.discordID);
    //return getKeyByValue(this.channels, this.bot.getUserVoiceChannel(player.discordID));
    return expectedSim;
  }

  //strings in
  movePlayerToSim(player, sim)
  {
    console.log(chalk.blueBright("GameManager"), chalk.yellow("movePlayerToSim"), player, sim);
    if(this.sims[sim] === undefined) {
      console.log(chalk.blueBright("GameManager"), chalk.red("movePlayerToSim sim is undefined"), player, sim);
      return false;
    }
    this.movePlayerToCall(player, this.sims[sim].channel);
    this.players[player].sim = sim;
  }

  movePlayerToCall(player, call)
  {
    console.log(chalk.blueBright("GameManager"), chalk.yellow("movePlayerToCall"), player, call);
    this.bot.setUserVoiceChannel(player, this.channels[call]);
  }


  getGameState()
  {
    var obj = [];
    var playerLocs = this.getAllPlayerLocs();
    //var channels = this.channels;
    var sims = this.sims;
    Object.keys(this.sims).forEach(key => {
      //var chan = channels[key];
      obj.push({
        players: playerLocs[key],
        id: key,
        name: sims[key].title
      });
    });
    console.info(chalk.yellow("Game State:"), obj);
    return obj;
  }

  // Just updates the player UI
  updatePlayerUI()
  {
    this.sockets.emit("gameInfo", this.getGameState());
    this.updateAdminUI();
  }

  // ================================================= ADMIN STUFF ================================================= 

  addAdminUser(data, socket)
  {
    this.admins[socket.id] = socket;
    socket.join('admins');
    socket.emit('authd', {"success":true});
    this.updateAdminUI();
  }

  // Kick a user from a private call
  kickUserFromCall(data)
  {
    console.info(chalk.yellow("Admin kicking user"), chalk.green(data.user), chalk.yellow("from a private call"));
    var user = this.players[data.user];
    if(user)
    {
      this.sockets.to(user.socket.id).emit("kickedFromCall", {"success": true});
    }
    else
    {
      for(var call in this.privateCalls)
      {
        if(this.privateCalls[call] != null || this.privateCalls[call] != [])
        {
          if(this.privateCalls[call].indexOf(data.user)>-1)
          {
            console.log(this.privateCalls[call]);
            var index = this.privateCalls[call].indexOf(data.user);
            if (index !== -1) {
              this.privateCalls[call].splice(index, 1);
            }
          }
        }
      }
    }
    this.updateAdminUI();
  }
  
  updateAdminUI()
  {
    this.sockets.to('admins').emit('adminStatus', this.adminGameStatus());
  }
  adminGameStatus()
  {

    return {
      gameState: this.getGameState(),
      privateCalls: this.privateCalls
    }
  }


  // ================================================= ADMIN STUFF ================================================= 
}

module.exports = ROCManager;


function getKeyByValue(object, value) {
  return Object.keys(object).find(key => object[key] === value);
}