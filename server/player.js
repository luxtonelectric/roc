class Player {
  constructor(panel, socket, discordID)
  {
    this.panel = panel;
    this.socket = socket;
    this.discordID = discordID;
    this.callQueue = {};
    this.inCall = false;
  }

  
  setPanel(panel)
  {
    this.panel = panel;
  }
}


module.exports = Player;