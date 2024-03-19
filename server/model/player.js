// @ts-check

import { Socket } from "socket.io";


export default class Player {
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
}