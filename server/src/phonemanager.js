// @ts-check
import chalk from 'chalk'

import Phone from "./model/phone.js";
import Location from './model/location.js';
import Panel from './model/panel.js';
import SimulationLoader from './services/SimulationLoader.js';
/** @typedef {import("socket.io").Server} Server */
/** @typedef {import("./model/simulation.js").default} Simulation */
/** @typedef {import("./model/phonebookentry.js").default} PhonebookEntry */
/** @typedef {import("./model/train.js").default} Train */
/** @typedef {import("./model/player.js").default} Player */

export default class PhoneManager {  
  // Constants
  static CONTROL_SUFFIX = '_control';
  static PHONE_ID_SEPARATOR = '_';

  /** @type {Phone[]} */
  phones = [];

  /** @type {Simulation[]} */
  sims = [];

  /** @type {SimulationLoader} */
  simulationLoader;

  /**
   * @param {SimulationLoader} simulationLoader The simulation loader service
   */
  constructor(simulationLoader) {
    this.simulationLoader = simulationLoader;
  }

  /**
   * Remove a simulation from the phone manager
   * @param {string} simId The ID of the simulation to remove
   * @param {function(string, boolean): Simulation|undefined} getSimDataFn Function to get simulation data
   */
  removeSim(simId, getSimDataFn) {
    // Get the list of active sims excluding the one being removed
    const activeSims = this.sims.filter(s => s.id !== simId);

    // Use the existing cleanup logic which preserves needed neighbor phones
    this.removeUnusedNeighbourPhones(getSimDataFn, simId, activeSims);

    // Remove the sim from our tracked sims
    this.sims = this.sims.filter(s => s.id !== simId);
  }
  /**
   * Generate phones for a simulation and its neighbors
   * @param {Simulation} sim The simulation to generate phones for
   * @param {Set<string>} [excludePanelIds] Optional set of panel IDs to exclude (already have phones)
   * @return {Panel[]} The panels that were processed (with phones assigned)
   */
  generatePhonesForSim(sim, excludePanelIds = new Set()) {
    // Create a phone for each panel in the sim that doesn't already have one
    sim.panels.forEach((panel) => {
      // Skip if this panel already has a phone due to being a neighbor
      if (!excludePanelIds.has(panel.id)) {
        const phone = this.generatePhoneForPanel(sim, panel);
        panel.phone = phone;
      }
    });

    // Generate neighbor phones for all panels in this sim
    sim.panels.forEach((panel) => {
      panel.neighbours.forEach((neighbour) => {
        // Skip if neighbor is in the same sim
        if (neighbour.simId === sim.id) {
          return;
        }

        // Load the neighbor sim data
        const neighbourSim = this.simulationLoader.loadSimulation(neighbour.simId);
        if (!neighbourSim) {
          return;
        }

        // Check if neighbor panel exists
        const neighbourPanel = neighbourSim.getPanel(neighbour.panelId);
        if (!neighbourPanel) {
          return;
        }

        // Check if phone already exists
        const phoneId = neighbourSim.id + PhoneManager.PHONE_ID_SEPARATOR + neighbourPanel.id;
        const existingPhone = this.getPhone(phoneId);
        
        // Only create a phone if it doesn't exist
        if (!existingPhone) {
          const phone = this.generatePhoneForPanel(neighbourSim, neighbourPanel);
          neighbourPanel.phone = phone;
        }
      });
    });

    // Create a phone for Control
    // TODO: Add ability to configure additional phones for the Sim.
    this.phones.push(new Phone(sim.id + PhoneManager.CONTROL_SUFFIX, sim.name + ' Control', Phone.TYPES.FIXED, new Location(sim.id)));

    this.sims.push(sim);
    return sim.panels;
  }

  /**
   * @param {Train} train 
   * @returns {Phone}
   */
  generatePhoneForTrain(train) {
    const phone = new Phone(train.getSUID(), train.getHeadcode(), Phone.TYPES.TRAIN)
    phone.setCarrier(train);
    this.phones.push(phone);
    return phone;
  }

  /**
   * @param {Simulation} sim
   * @param {Panel} panel 
   * @returns {Phone}
   */
  generatePhoneForPanel(sim, panel) {
    const phoneId = sim.id + PhoneManager.PHONE_ID_SEPARATOR + panel.id;
    // Check if phone already exists
    const existingPhone = this.getPhone(phoneId);
    if (existingPhone) {
      return existingPhone;
    }

    const phone = new Phone(phoneId, sim.name + " " + panel.name, Phone.TYPES.FIXED, new Location(sim.id, panel.id))
    this.phones.push(phone);
    return phone;
  }

  /**
   * @param {string} number 
   * @param {string} name 
   * @param {string} type 
   * @param {Location} location 
   * @param {boolean} hidden 
   * @returns {Phone | undefined}
   */
  generatePhoneForPerson(number, name, type=Phone.TYPES.MOBILE, location = null, hidden=false) {
    if(number && !this.phones.some(p => p.getId() === number)) {
      const phone = new Phone(number, name, type, location, hidden)
      this.phones.push(phone);
      return phone;
    }else {
      throw new Error('Invalid number or number already exists');
    }
  }


  /**
   * @param {Phone} phone 
   * @returns {PhonebookEntry[]}
   */
  getSpeedDialForPhone(phone) {
    let phones = [];
    
    if(phone.getLocation() !== null) {
      const sim = this.sims.find(x => x.id === phone.getLocation().simId);
      if(sim) {
        const panel = sim.getPanel(phone.getLocation().panelId);
        if(panel) {
          const neighbourPhones = panel.neighbours.map(nb => this.getPhone(nb.simId + PhoneManager.PHONE_ID_SEPARATOR + nb.panelId));
          phones.push(...neighbourPhones);
        }
        const control = this.phones.filter(x => x.getId() === sim.id + PhoneManager.CONTROL_SUFFIX && x.getId() !== phone.getId());
        phones.push(...control);
      }

    }

    // Filter out any undefined phones before mapping
    return phones.filter(p => p !== undefined).map(p => p.toSimple());
  }

  /**
   * @param {Phone} phone 
   * @returns {PhonebookEntry[]}
   */
  getTrainsAndMobilesForPhone(phone) {
    const trainPhones = this.phones.filter(p => p.isInSameSim(phone) && p.isType(Phone.TYPES.TRAIN)).map(p => p.toSimple());
    const mobilePhones = this.phones.filter(p => p.isInSameSim(phone) && p.isType(Phone.TYPES.MOBILE)).map(p => p.toSimple());
    const allPhones = trainPhones.concat(mobilePhones);
    return allPhones;
  }

  /**
   * @param {Phone} phone 
   * @returns {Phone[]}
   */
  getRECRecipientsForPhone(phone) {
    let phones = [];
    
    // Find the location of the phone
    const sim = this.sims.find(s => s.id === phone.getLocation().simId);
    if (!sim) {
      console.error(chalk.red('getRECRecipientsForPhone'), 'Simulation not found:', phone.getLocation().simId, 'for phone:', phone.getId());
      return [];
    }
    
    const panel = sim.getPanel(phone.getLocation().panelId);
    if (!panel) {
      console.error(chalk.red('getRECRecipientsForPhone'), 'Panel not found:', phone.getLocation().panelId, 
        'in simulation:', phone.getLocation().simId, 'for phone:', phone.getId());
      console.error(chalk.red('getRECRecipientsForPhone'), 'Available panels in simulation:', sim.panels.map(p => p.id));
      return [];
    }

    const neighbourPhones = panel.neighbours.map(nb => this.getPhone(nb.simId + PhoneManager.PHONE_ID_SEPARATOR + nb.panelId));

    phones.push(...neighbourPhones);
    
    // Include control
    const control = this.phones.find(x => x.getId() === sim.id + PhoneManager.CONTROL_SUFFIX && x.getDiscordId() !== null);
    if(control) {
      phones.push(control)
    }
    
    return phones;
  }

  /**
   * @param {string} phoneId 
   * @returns {(Phone | undefined)}
   */
  getPhone(phoneId) {
    return this.phones.find(p => p.getId() === phoneId);
  }

  getAllPhones() {
    return this.phones.map(p => p.toAdminView());
  }

  /**
   * @param {Phone} phone 
   * @param {Player} player 
   * @returns 
   */
  assignPhone(phone, player) {
    if (typeof phone === 'undefined') {
      return false;
    }
    phone.setPlayer(player);
    this.sendPhonebookUpdateToPlayer(player);
    return true;
  }

  /**
   * @param {Phone} phone 
   * @returns 
   */
  unassignPhone(phone) {
    if (typeof phone === 'undefined') {
      return false;
    }
    const player = phone.getPlayer();
    phone.setPlayer(null);
    this.sendPhonebookUpdateToPlayer(player);
    return true;
  }

  unassignPhonesForDiscordId(discordId) {
    const phones = this.getPhonesForDiscordId(discordId);
    phones.forEach(p => p.setPlayer(null));
    this.sendPhonebookUpdateToPlayer(discordId);
  }

  /**
   * Remove phones for panels in neighboring sims that are no longer needed
   * @param {function(string, boolean): Simulation|undefined} getSimDataFn Function to get simulation data
   * @param {string} simId The simulation ID to clean up neighbors for
   * @param {Simulation[]} activeSims Array of simulations that will remain active (not including the one being deactivated)
   */
  removeUnusedNeighbourPhones(getSimDataFn, simId, activeSims) {
    const sim = getSimDataFn(simId, true);
    if (!sim) {
      return;
    }
    
    const neighborPhoneIds = new Set();
    sim.panels.forEach(panel => {
      panel.neighbours.forEach(neighbour => {
        // Skip if neighbor is in the same sim
        if (neighbour.simId === simId) return;
        
        const phoneId = neighbour.simId + PhoneManager.PHONE_ID_SEPARATOR + neighbour.panelId;
        neighborPhoneIds.add(phoneId);
      });
    });

    const neighborMap = new Map();

    const simToDeactivate = getSimDataFn(simId,false);
    if (!simToDeactivate) {
      return;
    }

    const addNeighborRelationship = (sim, panel) => {
      const phoneId = sim.id + PhoneManager.PHONE_ID_SEPARATOR + panel.id;
        
      panel.neighbours.forEach(neighbour => {
        const neighborId = neighbour.simId + PhoneManager.PHONE_ID_SEPARATOR + neighbour.panelId;

        if (!neighborMap.has(phoneId)) neighborMap.set(phoneId, new Set());
        neighborMap.get(phoneId).add(neighborId);

        if (!neighborMap.has(neighborId)) neighborMap.set(neighborId, new Set());
        neighborMap.get(neighborId).add(phoneId);
      });
    };

    [...activeSims, simToDeactivate].forEach(sim => {
      sim.panels.forEach(panel => {
        addNeighborRelationship(sim, panel);
      });
    });

    // Find all phones that are still needed - a phone is needed if:
    // 1. One of its neighbors belongs to an active sim
    // 2. It belongs to an active sim and has a neighbor in any sim
    const neededPhoneIds = new Set();
    
    neighborMap.forEach((neighbors, phoneId) => {
      neighbors.forEach(neighborId => {
        const [neighborSimId] = neighborId.split('_');
        if (activeSims.some(s => s.id === neighborSimId)) {
          neededPhoneIds.add(phoneId);
          neededPhoneIds.add(neighborId);
          //console.log(`Adding needed phone pair (active sim): ${phoneId} <-> ${neighborId}`);
        }
      });
    });

    const phonesToRemove = this.phones.filter(phone => {
      const location = phone.getLocation();
      if (!location) return false;
      
      const phoneId = location.simId + PhoneManager.PHONE_ID_SEPARATOR + location.panelId;

      if (location.simId === simId) {
        // Keep this phone if it's needed by a neighbor
        if (neededPhoneIds.has(phoneId)) {
          return false;
        }
        return true; // Remove all other phones from the deactivated sim
      }

      if (!neighborPhoneIds.has(phoneId)) return false;
      return !neededPhoneIds.has(phoneId);
    });

    // Remove the unused phones
    phonesToRemove.forEach(phone => {
      // Unassign any player first
      if (phone.getPlayer()) {
        this.unassignPhone(phone);
      }
      
      // Remove from phones array
      this.phones = this.phones.filter(p => p.getId() !== phone.getId());
    });
  }

  /**
   * @param {string} discordId 
   * @returns 
   */
  getPhonesForDiscordId(discordId) {
    const phones = this.phones.filter(p => p.getDiscordId() === discordId);
    return phones;
  }

  /**
   * @param {Player} player 
   */
  sendPhonebookUpdateToPlayer(player) {
    const phones = this.getPhonesForDiscordId(player.discordId);
    phones.forEach((p) => { p.setSpeedDial(this.getSpeedDialForPhone(p)); p.setTrainsAndMobiles(this.getTrainsAndMobilesForPhone(p)) });
    const book = phones.map(p => p.getPhoneBook());
    if(player.socket) {
      player.socket.emit('phonebookUpdate', book);
    }
  }
}
