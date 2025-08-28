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
   */
  constructor(simId, simData) {
    this.id = simId;
    this.name = simData.name;
    simData.panels.forEach(panelData => {
      this.panels.push(Panel.fromSimData(panelData));
      for (const loc of panelData.reportingLocations ?? []) {
        this.locationToPanelMap.set(loc, panelData.id)
      }
    });
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