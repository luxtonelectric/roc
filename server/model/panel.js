/** @typedef {import("./location.js").default} Location */
export default class Panel {
  id;
  name;
  player;
  /** @type {Location[]} */
  neighbours = [];
  phone;

  static fromSimData(panelData) {
    const panel = new Panel();
    panel.id = panelData.id;
    panel.name = panelData.name;
    panelData.neighbours.forEach(p => panel.neighbours.push(p));
    return panelData;
  }
}