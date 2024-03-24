export default class PhonebookEntry {
  /** @type {string} */
  id;
  /** @type {string} */
  name;
  /** @type {string} */
  type;

  constructor(id,name,type) {
    this.id = id;
    this.name = name;
    this.type = type;
  }
}