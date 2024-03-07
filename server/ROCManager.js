import chalk from 'chalk'
import Player from './player.js';
import betterLogging from 'better-logging';
import DiscordBot from './bot.js';
betterLogging(console,{
  format: ctx => `${ctx.date}${ctx.time24}${ctx.type}${ctx.STAMP('ROCManager.js', chalk.blueBright)} ${ctx.msg}`
});

export default class ROCManager {
  players = {};
  admins = {};
  phones = {};
  privateCalls;
  constructor(sockets, bot, config) {
    this.sockets = sockets;
    this.bot = bot;
    this.guild = config.guild;
    this.channels = config.channels;
    this.sims = config.sims;
    this.phones = config.phones;
    this.config = config;
    this.privateCalls = config.privateCalls;
    console.info(chalk.yellow("constructor"), `Welcome! Yum yum!`);
  }
  
  
  // ============================= BEGIN PLAYER CODE =============================


  //takes player object
  async addPlayer(newPlayer) {
    console.info(chalk.yellow("AddPlayer"), "New Player Joining");
    if (typeof newPlayer.discordID !== 'undefined' && newPlayer.discordID.length > 2)
    {
      var channel = await this.bot.getUserVoiceChannel(newPlayer.discordID);
      if (channel) {
        console.info(chalk.yellow("AddPlayer"), `User ${newPlayer.discordID} is in a voice channel:`, chalk.magentaBright(channel));

        if(this.players[newPlayer.discordID] !== undefined) {
          // This player has already logged in!
          const existingPlayer = this.players[newPlayer.discordID];
          
          if(existingPlayer.isConnected === false) {
            console.info(chalk.yellow("AddPlayer"), `User ${newPlayer.discordID} is reconnecting after socket disconnect`);
            // They DCd and we caught it just let them back in
            if(existingPlayer.sim === channel) {
              //They're still in the same place they were before. Everything is good with the world
            } else {
              //They're somehow changed rooms... guess we should update
              existingPlayer.sim = channel;
            }

            existingPlayer.socket = newPlayer.socket;
            existingPlayer.isConnected = true;
            this.sockets.to(existingPlayer.socket.id).emit("loggedIn", {
              "loggedIn": true,
              "error": ""
            });
            this.updatePlayerUI();
            this.updatePlayerInfo(existingPlayer);
            return true;
          } else {
            // They're connecting twice for the same person?! This is sus. Follow normal login.
          }
          
        } else{
          // Brand new Player
          //console.log("Brand New Player!");
        }

        if (channel === this.channels.lobby) {
          console.info(chalk.yellow("AddPlayer"), `User ${newPlayer.discordID} is in lobby channel`);
          newPlayer.sim = "lobby";
          this.players[newPlayer.discordID] = newPlayer;
          // this.players[player.discordID].inCall = true;
          // console.info(this.players);
          this.sockets.to(newPlayer.socket.id).emit("loggedIn", {
            "loggedIn": true,
            "error": ""
          });
          this.updatePlayerUI();
          this.updatePlayerInfo(newPlayer);
        } else {
          console.info(chalk.yellow("AddPlayer"), `User ${newPlayer.discordID} is not in the lobby.`);
          this.sockets.to(newPlayer.socket.id).emit("loggedIn", {
            "loggedIn": false,
            "error": `You aren't in the lobby. Please join ${this.channels.lobby} to join the game.`
          });
        }
      } else {
        console.info(chalk.yellow("AddPlayer"), `User ${newPlayer.discordID} is not in a voice channel:`);
        this.sockets.to(newPlayer.socket.id).emit("loggedIn", {
          "loggedIn": false,
          "error": "You aren't in a voice chat.."
        });
        return false;
      }
    } else {
      console.info(chalk.yellow("AddPlayer"), `User ${newPlayer.discordID} is not a discord username. What?`);
      this.sockets.to(newPlayer.socket.id).emit("loggedIn", {
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

  findPlayerBySocketId(socketId) {
    for(var [key, value] of Object.entries(this.players))
    {
      if(value.socket.id === socketId)
      {
        return this.players[key];
      }
    }
    return null;
  }

  checkDisconnectingPlayer(socketId) {
    const player = this.findPlayerBySocketId(socketId);
    if(player === null) {
      return false;
    }
    
    const playerChannel = this.bot.getUserVoiceChannel(player.discordID);
    if(playerChannel === null) {
      //The player is not in voice then assume they've left and delete them.
      this.deletePlayer(socketId);
    } else {
      console.log(chalk.yellow("checkDisconnectingPlayer"), player.discordID ,chalk.white("has lost connection but is still in voice. Maintaining game state."));
      //The player is still in voice then assume they're coming back and don't delete them but mark them away
      player.isConnected = false;
      this.updatePlayerUI();
    }

    
  }

  //Takes in a SocketId
  deletePlayer(socketId)
  {
    console.log("Player wishes to leave:", socketId);
    // Delete the player from the players list...
    for(var [key, value] of Object.entries(this.players))
    {
      if(value.socket.id === socketId)
      {
        console.log(chalk.yellow("Delete Player"), key ,chalk.white("was deleted from the game"));
        delete this.players[key];
        // Unclaim any claimed panels
        for(var skey of Object.keys(this.sims))
        {
          if(typeof this.sims[skey].panels !== "undefined") {
            for(var pkey of Object.keys(this.sims[skey].panels))
            {
              if(this.sims[skey].panels[pkey].player === key) {
                console.log(chalk.yellow("Delete Player"), key, chalk.white("was removed as controlling panel"), pkey);
                this.sims[skey].panels[pkey].player = undefined;
              }
            }
          }
        }
      }
    }
    this.updatePlayerUI();
  }

  claimPanel(user, requestedSim, requestedPanel) {
    const player = this.players[user];
    if(typeof player === "undefined") {
      console.error(chalk.red("Claim panel called with undefined player"), user, requestedSim, requestedPanel);
      return false;
    }

    const sim = this.sims[requestedSim]; 
    if(typeof sim === "undefined") {
      console.error(chalk.red("Claim panel called with undefined sim"), user, requestedSim, requestedPanel);
      return false;
    }

    const panel = sim.panels[requestedPanel]; 
    if(typeof panel === "undefined") {
      console.error(chalk.red("Claim panel called with undefined panel"), user, requestedSim, requestedPanel);
      return false;
    }
    //Assign the player to the panel
    panel.player = user;
    this.phones[panel.phone].player = user;
    //Update the panel's phone to be assigned to the player
    this.updatePlayerInfo(player);
    this.updatePlayerUI();
  }

  releasePanel(user, requestedSim, requestedPanel) {
    const player = this.players[user];
    if(typeof player === "undefined") {
      console.error(chalk.red("Claim panel called with undefined player"), user, requestedSim, requestedPanel);
      return false;
    }

    const sim = this.sims[requestedSim]; 
    if(typeof sim === "undefined") {
      console.error(chalk.red("Claim panel called with undefined sim"), user, requestedSim, requestedPanel);
      return false;
    }

    const panel = sim.panels[requestedPanel]; 
    if(typeof panel === "undefined") {
      console.error(chalk.red("Claim panel called with undefined panel"), user, requestedSim, requestedPanel);
      return false;
    }
    //Assign the player to the panel
    panel.player = undefined;
    this.phones[panel.phone].player = undefined;
    //Update the panel's phone to be assigned to the player
    this.updatePlayerUI();
  }


  // ============================== END PLAYER CODE ==============================

  // ============================== BEGIN CALL CODE ==============================


  // take in an object with sender and reciever
  placeCall(socketId, receiverPhoneId, senderPhoneId)
  {
    if (typeof this.phones[receiverPhoneId] === 'undefined' || typeof this.phones[receiverPhoneId].player === 'undefined') {
      console.warn(chalk.red("Receiver phone not valid: "), receiverPhoneId, senderPhoneId, this.phones);
      this.sockets.to(socketId).emit('rejectCall', {"success":false})
      return false;
    }

    if (typeof this.phones[senderPhoneId] === 'undefined' || typeof this.phones[senderPhoneId].player === 'undefined') {
      console.warn(chalk.red("Sender phone not valid: "), receiverPhoneId, senderPhoneId, this.phones);
      this.sockets.to(socketId).emit('rejectCall', {"success":false})
      return false;
    }

    const sendingPhone = this.phones[senderPhoneId];
    const sendingPlayerId = sendingPhone.player;
    const sendingPlayer = this.players[sendingPlayerId];

    if(socketId !== sendingPlayer.socket.id) {
      console.error(chalk.red("ATTEMPTING TO MAKE A CALL FOR ANOTHER USER"), receiverPhoneId, senderPhoneId, this.phones);
      this.sockets.to(socketId).emit('rejectCall', {"success":false})
      return false;
    }

    const receivingPhone = this.phones[receiverPhoneId];
    const receivingPlayerId = receivingPhone.player;
    const receivingPlayer = this.players[receivingPlayerId];

    
    if(typeof receivingPlayer === "undefined") {
      console.error(chalk.red("Attempting to call a player that does not exist"), receivingPlayerId);
      this.sockets.to(socketId).emit('rejectCall', {"success":false})
      return false;
    }

    if(sendingPlayer !== receivingPlayer) {
      console.info(chalk.yellow("Placing Call"), chalk.magentaBright("Caller:"), sendingPlayer.discordID, chalk.magentaBright("Reciever:"), receivingPlayer.discordID);
      receivingPlayer.callQueue[sendingPlayer.discordID] = {"senderId": senderPhoneId, "senderName": sendingPhone.displayName, "receiverId": receiverPhoneId, "receiverName": receivingPhone.displayName,"timePlaced": Date.now()};
      console.log(chalk.yellow("Queue for"), receivingPlayer.discordID, receivingPlayer.callQueue);
      receivingPlayer.socket.emit("newCallInQueue", receivingPlayer.callQueue);
      //this.players[data.user] = reciever; //???
      this.updatePlayerUI();
    } else {
      console.log(chalk.yellow("A player ("), sendingPlayer.discordID, chalk.yellow(")tried to call themselves as was rejected."));
      this.sockets.to(socketId).emit('rejectCall', {"success":false})
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

  acceptCall(socketId, senderPhoneId,receiverPhoneId)
  {
    if (typeof this.phones[receiverPhoneId] === 'undefined' || typeof this.phones[receiverPhoneId].player === 'undefined') {
      console.warn(chalk.red("Receiver phone not valid: "), receiverPhoneId, senderPhoneId, this.phones);
      this.sockets.to(socketId).emit('rejectCall', {"success":false})
      return false;
    }

    if (typeof this.phones[senderPhoneId] === 'undefined' || typeof this.phones[senderPhoneId].player === 'undefined') {
      console.warn(chalk.red("Sender phone not valid: "), receiverPhoneId, senderPhoneId, this.phones);
      this.sockets.to(socketId).emit('rejectCall', {"success":false})
      return false;
    }

    const sendingPhone = this.phones[senderPhoneId];
    const sendingPlayerId = sendingPhone.player;
    const sendingPlayer = this.players[sendingPlayerId];

    const receivingPhone = this.phones[receiverPhoneId];
    const receivingPlayerId = receivingPhone.player;
    const receivingPlayer = this.players[receivingPlayerId];

    if(socketId !== receivingPlayer.socket.id) {
      console.error(chalk.red("ATTEMPTING TO MAKE A CALL FOR ANOTHER USER"), receiverPhoneId, senderPhoneId, this.phones);
      this.sockets.to(socketId).emit('rejectCall', {"success":false})
      return false;
    }
    
    if(typeof receivingPlayer === "undefined") {
      console.error(chalk.red("Attempting to call a player that does not exist"), data);
      this.sockets.to(socketId).emit('rejectCall', {"success":false})
      return false;
    }

    if(sendingPlayer.inCall === false)
    {
      const available = this.getAvailableCallChannel();
      
      if(available !== null) {
        console.log(chalk.blueBright("GameManager"), chalk.yellow("Join Call"), chalk.magenta("Length:"), this.privateCalls[available].length);
        this.privateCalls[available] = [receivingPlayerId, sendingPlayerId];
        this.joinCall(sendingPlayer, receivingPlayer, available);
      } else {
        this.sockets.to(sendingPlayer.socket.id).emit('rejectCall', {"success":false})
      }
    }
    else
    {
      this.sockets.to(sendingPlayer.socket.id).emit('rejectCall', {"success":false})
    }
  }

  rejectCall(socketId,senderPhoneId,receiverPhoneId)
  {
    if (typeof this.phones[receiverPhoneId] === 'undefined' || typeof this.phones[receiverPhoneId].player === 'undefined') {
      console.warn(chalk.red("Receiver phone not valid: "), receiverPhoneId, senderPhoneId, this.phones);
      this.sockets.to(socketId).emit('rejectCall', {"success":false})
      return false;
    }

    if (typeof this.phones[senderPhoneId] === 'undefined' || typeof this.phones[senderPhoneId].player === 'undefined') {
      console.warn(chalk.red("Sender phone not valid: "), receiverPhoneId, senderPhoneId, this.phones);
      this.sockets.to(socketId).emit('rejectCall', {"success":false})
      return false;
    }

    const senderPlayerId = this.phones[senderPhoneId].player;
    const receiverPlayerId = this.phones[receiverPhoneId].player;

    delete this.players[receiverPlayerId].callQueue[senderPlayerId];
    this.sockets.to(this.players[senderPlayerId].socket.id).emit("rejectCall",{"success": false});
    this.sockets.to(this.players[receiverPlayerId].socket.id).emit('updateMyCalls', this.players[receiverPlayerId].callQueue);
    this.updatePlayerUI();
  }

  joinCall(sendingPlayer, receivingPlayer, channel)
  {
    var success = false;
    console.log(chalk.blueBright("GameManager"), chalk.yellow("Join Call"), chalk.magenta("Incoming Data"), sendingPlayer.discordID, receivingPlayer.discordID, channel);

    if(this.movePlayerToCall(sendingPlayer.discordID, channel)) {
      if(this.movePlayerToCall(receivingPlayer.discordID, channel)) {
        //both players joined call
        this.sockets.to(sendingPlayer.socket.id).emit("joinedCall",{"success":true});
        this.sockets.to(receivingPlayer.socket.id).emit("joinedCall",{"success":true});
        this.players[sendingPlayer.discordID].inCall = true;
        this.players[receivingPlayer.discordID].inCall = true;
        delete this.players[receivingPlayer.discordID].callQueue[sendingPlayer.discordID];
        this.sockets.to(receivingPlayer.socket.id).emit('updateMyCalls', this.players[receivingPlayer.discordID].callQueue);
      } else {
        // could not move receiving player
        // TODO: Handle this error condition
      }
    } else {
      // could not move the sending player
      // TODO: Handle this error condition
    }
    this.updatePlayerUI();
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
    console.log(chalk.yellow("Leave Call"), chalk.magenta("Priv Call:"), this.privateCalls);
  }


  // =============================== END CALL CODE ===============================

// REc
 playerJoinREC(playerId, channelId)
 {
   console.log(chalk.yellow("Player joining REC:"), chalk.white(playerId));
  this.movePlayerToCall(playerId, channelId);
  this.sockets.to(this.players[playerId].socket.id).emit("joinedCall",{"success":true});
 }

playerStartREC(playerId, panelId)
  {
    console.log(chalk.yellow("playerStartREC"), chalk.magenta("REC started for"), panelId, chalk.magenta("by"), playerId);
    
    const panelParts = panelId.split(".");
      if(panelParts.length !== 2 || typeof this.sims[panelParts[0]] === "undefined" || typeof this.sims[panelParts[0]].panels[panelParts[1]] === "undefined") {
        console.log("REC Started for invalid panelId", panelId);
        return false;
      }
    
    const available = this.getAvailableCallChannel();
    if(available !== null) {     
      //First get the list of players to call... 
      const playersToCall = [];
      const panel = this.sims[panelParts[0]].panels[panelParts[1]];

      if(typeof panel.neighbours !== 'undefined') {
        for (let index = 0; index < panel.neighbours.length; index++) {
          const neighbourPanelId = panel.neighbours[index];
          const neighbourPanelParts = neighbourPanelId.split(".");
          if(neighbourPanelParts.length == 1) {
            neighbourPanelParts.unshift(panelParts[0]);
          }
          const neighbourPanel = this.sims[neighbourPanelParts[0]].panels[neighbourPanelParts[1]];
          if(typeof neighbourPanel.player !== 'undefined') {
            playersToCall.push(neighbourPanel.player);
          }
        }  
      }

      

      const uniquePlayersToCall = [...new Set(playersToCall)];
      if(uniquePlayersToCall.indexOf(playerId) >-1 ) {
        uniquePlayersToCall.splice(uniquePlayersToCall.indexOf(playerId),1)
      }

      //Actually call people
      this.privateCalls[available].push(playerId);
      this.playerJoinREC(playerId,available);

      uniquePlayersToCall.forEach(playerIdToCall => {
        console.log(chalk.blueBright("playerStartREC"), chalk.yellow("Calling players..."), chalk.white(), playerIdToCall);
        var player = this.players[playerIdToCall];
        this.privateCalls[available].push(playerIdToCall);
        this.sockets.to(player.socket.id).emit('incomingREC',{"channel":available});
      })
    } else {
      console.log(chalk.red("REC Failed due to no available call channels"))
    }
    
  }

// end REC


  getPlayerPhones(playerID){
    const keys = Object.keys(this.phones).filter((key) => this.phones[key].player === playerID);
    const result = [];
    result.push()
    keys.forEach((x) => {
       const y = this.phones[x];
       y.id = x;
       result.push(y);
    });
    return result;
  }


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
      const allPhones = this.getPlayerPhones(key);
      if (!locations[loc]){ locations[loc] = [];}
      var player = {discordID: value.discordID, connected: value.isConnected, panel: value.panel, inCall: value.inCall, callQueue: value.callQueue, phones:allPhones};
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

  async movePlayerToCall(player, call)
  {
    console.log(chalk.blueBright("GameManager"), chalk.yellow("movePlayerToCall"), player, call);
    return await this.bot.setUserVoiceChannel(player, this.channels[call]);
  }


  getGameState()
  {
    var obj = [];
    const playerLocs = this.getAllPlayerLocs();
    //var channels = this.channels;
    var sims = this.sims;
    Object.keys(this.sims).forEach(key => {
      //var chan = channels[key];
      obj.push({
        players: playerLocs[key],
        panels: sims[key].panels,
        id: key,
        name: sims[key].title
      });
    });
    //console.info(chalk.yellow("Game State:"), obj);
    return obj;
  }

  // Just updates the player UI for all players
  updatePlayerUI()
  {
    this.sockets.emit("gameInfo", this.getGameState());
    this.updateAdminUI();
  }

  updatePlayerInfo(player) {
    const phones = this.getPlayerPhones(player.discordID);
    const info = {};
    info.phones = phones;
    this.sockets.to(player.socket.id).emit("playerInfo", info);
    //console.log(chalk.yellow("updatePlayerInfo"), info);
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
            //console.log(this.privateCalls[call]);
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

function getKeyByValue(object, value) {
  return Object.keys(object).find(key => object[key] === value);
}