/** @typedef {import("socket.io").Socket} Socket */

export default class Player {
  avatarURL = "";
  displayName = "";
  /**
   * 
   * @param {Socket} socket 
   * @param {string} discordId 
   * @param {string} voiceChannelId 
   */
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

  toSimple() {
    return {'discordId': this.discordId, 'displayName': this.displayName, 'avatarURL': this.avatarURL}
  }
}