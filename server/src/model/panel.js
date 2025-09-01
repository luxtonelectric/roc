/** @typedef {import("./phone.js").default} Phone */
/** @typedef {import("./location.js").default} Location */
export default class Panel {
  id;
  name;
  code;
  player;
  /** @type {Location[]} */
  neighbours = [];

  /**@type {Phone} */
  phone;

  static fromSimData(panelData) {
    const panel = new Panel();
    panel.id = panelData.id;
    panel.name = panelData.name;
    panel.code = panelData.code;
    panelData.neighbours.forEach(p => panel.neighbours.push(p));
    return panelData;
  }
}