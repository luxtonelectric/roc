/** @typedef {import("./phone.js").default} Phone */

import iLocatable from "./iLocatable.js";

export default class Train extends iLocatable {
  /** @type {string} */
  #uid;
  /** @type {string} */
  #simId;
  /** @type {string} */
  #headcode;
  /** @type {Phone} */
  #phone = null;
  /** @type {Phone[]} */
  #passengers = [];

  /**
   * 
   * @param {string} headcode 
   */
  constructor(simId, uid,headcode) {
    super();
    this.#simId = simId;
    this.#uid = uid;
    this.#headcode = headcode
  }

  getSUID() {
    return this.#simId + this.#uid;
  }

  /**
   * 
   * @param {Phone} passenger 
   */
  addPassenger(passenger) {
    this.#passengers.push(passenger)
  }

  /**
   * 
   * @param {Phone} phone 
   */
  setPhone(phone) {
    this.#phone = phone;
  }

  getHeadcode() {
    return this.#headcode;
  }

  setHeadcode(headcode) {
    this.#headcode = headcode;
  }

  /**
   * 
   * @returns {Phone}
   */
  getPhone() {
    return this.#phone;
  }
}