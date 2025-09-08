// @ts-check
import ClockData from "./clockData.js";
import Panel from "./panel.js";
import Location from "./location.js"

/**
 * @typedef {string | {not: string}} EraSpecifier
 */
/**
 * @typedef {Object} PanelData
 * @property {string} name
 * @property {string} id
 * @property {EraSpecifier | undefined} era
 * @property {Array<Location & { era?: EraSpecifier }>} neighbours
 * @property {Array<string>} reportingLocations
 */
/**
 * @typedef {Object} SimData
 * @property {string} name
 * @property {Array<string>} eras
 * @property {Array<PanelData>} panels
 */

/**
 * @param {Array<string>} activeEras
 * @param {EraSpecifier | undefined} era
 */
function isEraActive(activeEras, era) {
  return era === undefined ? true : typeof era === "string" ? activeEras.includes(era) : !activeEras.includes(era.not);
}

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
   * @param {SimData} simData
   * @param {Array<string>} activeEras
   */
  constructor(simId, simData, activeEras) {
    this.id = simId;
    this.name = simData.name;
    simData.panels.forEach(panelData => {
      if (!isEraActive(activeEras, panelData.era)) return;
      panelData.neighbours = panelData.neighbours.filter((link) => 
        isEraActive(activeEras, link.era) && isEraActive(activeEras, simData.panels.find(p => p.id === link.panelId)?.era)
		  );

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