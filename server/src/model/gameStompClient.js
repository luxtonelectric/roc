/** @typedef {import("@stomp/stompjs").Client} Client */
/**
 * Repesents a container for a STOMP client for a Game.
 */
export default class GameStompClient{
  /** @type {string} */
  id;

  /** @type {Client} */
  client;

  game;

  /**
   * 
   * @param {string} id 
   * @param {Client} client
   * @param {*} game  
   */
  constructor(id, game, client) {
    this.id = id;
    this.game = game;
    this.client = client
  }
}