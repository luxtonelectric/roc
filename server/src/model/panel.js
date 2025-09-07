/** @typedef {import("./phone.js").default} Phone */
/** @typedef {import("./location.js").default} Location */
export default class Panel {
  id;
  name;
  player;
  /** @type {Location[]} */
  neighbours = [];
  /** @type {{ id: string, displayName: string, avatarURL: string } | undefined} */
  playerDetails;
  /**@type {Phone} */
  phone;

  static fromSimData(panelData) {
    const panel = new Panel();
    panel.id = panelData.id;
    panel.name = panelData.name;
    panelData.neighbours.forEach(p => panel.neighbours.push(p));
    return panelData;
  }
}