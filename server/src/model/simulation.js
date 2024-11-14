// @ts-check
import ClockData from "./clockData.js";
import Panel from "./panel.js";

export default class Simulation {
  id;
  /** @type {Panel[]} */
  panels = [];
  /** @type {boolean} */
  enabled = true;
  /** @type {string} */
  name;
  /** @type {string} */
  channel;
  /** @type {ClockData} */
  time;

  /**
   * 
   * @param {*} simData 
   * @returns {Simulation} 
   */
  static fromSimData(simData) {
    const sim = new Simulation();
    sim.id = simData.id;
    sim.name = simData.name;
    simData.panels.forEach(p => sim.panels.push(Panel.fromSimData(p)));
    return sim;
  }

  /**
   * 
   * @param {string} panelId 
   * @returns {Panel} 
   */
  getPanel(panelId) {
    return this.panels.find((p) => {return p.id === panelId});
  }
}