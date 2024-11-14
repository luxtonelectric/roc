/** @typedef {import("../stomp").TrainLocationUpdate} TrainLocationUpdate */
export default class TrainLocationMessage {
  #simId;
  #headcode;
  #uid;
  #action;
  #location;
  #platform;
  #time;
  #aspPass;
  #aspAppr;

  /**
   * @param {string} simId
   * @param {{train_location: TrainLocationUpdate}} msg 
   */
  constructor(simId,msg) {
    this.#simId = simId;
    this.#headcode = msg.train_location.headcode;
    this.#action = msg.train_location.action;
    this.#aspAppr = msg.train_location.aspAppr;
    this.#location = msg.train_location.location;
    this.#platform = msg.train_location.platform;
    this.#time = msg.train_location.time;
    this.#uid = msg.train_location.uid;
  }

  getUID() {
    return this.#uid;
  }

  getSimId() {
    return this.#simId;
  }

  getSUID() {
    return this.#simId + this.#uid;
  }

  getHeadcode() {
    return this.#headcode;
  }

  getLocation() {
    return this.#location;
  }
}