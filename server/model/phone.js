import PhonebookEntry from "./phonebookentry.js";
/** @typedef {import("./location.js").default} Location */

export default class Phone {
  static TYPES = { "FIXED": "fixed", "TRAIN": "train", "MOBILE": "Mobile" }
  /** @type {string} */
  id;
  /** @type {string} */
  name;
  /** @type {string} */
  type;
  /** @type {Location|null} */
  location;
  /** @type {string|null} */
  discordId;
  /** @type {boolean} */
  hidden;

  speedDial;
  trainsAndMobiles;
  /**
 * 
 * @param {string} id 
 * @param {string} name 
 * @param {string} type 
 * @param {Location | null} location 
 * @param {boolean} hidden 
 */
  constructor(id, name, type, location = null, hidden = false) {
    this.id = id;
    this.name = name;
    this.type = type;
    this.location = location;
    this.discordId = null;
    this.hidden = hidden;
  }

  /**
   * 
   * @returns {PhonebookEntry}
   */
  toSimple() {
    return new PhonebookEntry(this.id, this.name, this.type);
  }
}