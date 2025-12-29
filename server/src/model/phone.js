import iLocatable from "./iLocatable.js";
import PhonebookEntry from "./phonebookentry.js";
/** @typedef {import("./user.js").default} User */
/** @typedef {import("./location.js").default} Location */
/** @typedef {import("./iLocatable.js").default} iLocatable */

export default class Phone extends iLocatable {
  static TYPES = { "FIXED": "fixed", "TRAIN": "train", "MOBILE": "Mobile" }
  /** @type {string} */
  #id;
  /** @type {string} */
  #name;
  /** @type {string} */
  #type;

  /** @type {User} */
  #user

  /** @type {boolean} */
  #hidden;

  #speedDial = {};
  #trainsAndMobiles = {};
  /**
 * 
 * @param {string} id 
 * @param {string} name 
 * @param {string} type 
 * @param {Location | null} location 
 * @param {boolean} hidden 
 */
  constructor(id, name, type, location = null, hidden = false) {
    super(location)
    this.#id = id;
    this.#name = name;
    this.#type = type;
    this.#user = null;
    this.#hidden = hidden;
  }

  getId() {
    return this.#id
  }

  isType(typeString) {
    return this.#type === typeString;
  }

  /**
   * Helper function to return the assigned players discordID
   * @returns {string | null}
   */
  getDiscordId() {
    if (this.#user) {
      return this.#user.discordId;
    } else {
      return null;
    }
  }

  /**
   * 
   * @returns {Player}
   */
  getPlayer() {
    return this.#user;
  }

  /**
   * 
   * @param {Player} player 
   */
  setPlayer(player) {
    this.#user = player
  }

  getName() {
    return this.#name;
  }

  setName(name) {
    this.#name = name;
  }

  /**
   * 
   * @param {PhonebookEntry[]} phones 
   */
  setTrainsAndMobiles(phones) {
    this.#trainsAndMobiles = phones;
  }

  /**
   * 
   * @param {PhonebookEntry[]} phones 
   */
  setSpeedDial(phones) {
    this.#speedDial = phones
  }

  /**
   * 
   * @returns {PhonebookEntry}
   */
  toSimple() {
    return new PhonebookEntry(this.#id, this.#name, this.#type);
  }

  toAdminView() {
    const playerData = this.#user ? this.#user.toSimple() : undefined;
    return { 'id': this.#id, 'name': this.#name, 'type': this.#type, 'location': super.getLocation(), 'player': playerData }
  }

  getPhoneBook() {
    const phone = this.toSimple();
    phone.speedDial = this.#speedDial;
    phone.trainsAndMobiles = this.#trainsAndMobiles
    return phone;
  }
}