// @ts-check
import ClockData from "./clockData.js";
import Panel from "./panel.js";

export default class Simulation {
  id;
  /** @type {Panel[]} */
  panels = [];
  /** @type {boolean} */
  enabled = true;
  /** @type {boolean} */
  connectionsOpen = true;
  /** @type {string} */
  name;
  /** @type {{channel: string; host: string; port: number; interfaceGateway: { connected: boolean; enabled: boolean; }}} */
  config;
  
  /** @type {Map<string, string>} */
  locationToPanelMap = new Map()
  /** @type {ClockData} */
  time;

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