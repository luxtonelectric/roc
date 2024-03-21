/** @typedef {import("@stomp/stompjs").Client} Client */
/**
 * Repesents a container for a STOMP client for a Game.
 */
export default class GameStompClient{
  /** @type {string} */
  id;

  /** @type {Client} */
  client;

  /**
   * 
   * @param {string} id 
   * @param {Client} client 
   */
  constructor(id, client) {
    this.id = id;
    this.client = client
  }
}