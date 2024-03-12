export default class Player {
  constructor(socket, discordId, voiceChannelId)
  {
    this.socket = socket;
    this.discordId = discordId;
    this.voiceChannelId = voiceChannelId;
    this.callQueue = {};
    this.inCall = false;
    this.sim = "";
    this.isConnected = true;
  }

  
  setPanel(panel)
  {
    this.panel = panel;
  }
}