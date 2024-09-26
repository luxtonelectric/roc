// @ts-check
import Panel from "./panel.js";

export default class Simulation {
  id;
  /** @type {Panel[]} */
  panels = [];
  /** @type {boolean} */
  enabled = true;
  clock = 0;
  /** @type {string} */
  name;
  /** @type {string} */
  channel;
  /** @type {Map<string, string>} */
  locationToPanelMap = new Map()

  /**
   * @param {string} simId
   * @param {*} simData 
   * @returns {Simulation} 
   */
  static fromSimData(simId, simData) {
    const sim = new Simulation();
    sim.id = simId;
    sim.name = simData.name;
    simData.panels.forEach(panelData => {
      sim.panels.push(Panel.fromSimData(panelData));
      for (const loc of panelData.reportingLocations ?? []) {
        sim.locationToPanelMap.set(loc, panelData.id)
      }
    });
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

  /**
   * 
   * @param {string} location
   * @returns {string|undefined}
   */
  getPanelByLocation(location) {
    return this.locationToPanelMap.get(location)
  }
}