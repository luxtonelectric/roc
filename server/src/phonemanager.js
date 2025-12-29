// @ts-check
import chalk from 'chalk'

import Phone from "./model/phone.js";
import CallGroup from "./model/CallGroup.js";
import Location from './model/location.js';
import Panel from './model/panel.js';
import SimulationLoader from './services/SimulationLoader.js';
import CallGroupLoader from './services/CallGroupLoader.js';
import User from './model/user.js';
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

  /** @type {CallGroup[]} */
  callGroups = [];

  /** @type {Simulation[]} */
  sims = [];

  /** @type {SimulationLoader} */
  simulationLoader;

  /** @type {CallGroupLoader} */
  callGroupLoader;

  /**
   * @param {SimulationLoader} simulationLoader The simulation loader service
   * @param {CallGroupLoader} callGroupLoader The call group loader service (optional)
   */
  constructor(simulationLoader, callGroupLoader = null) {
    this.simulationLoader = simulationLoader;
    this.callGroupLoader = callGroupLoader || new CallGroupLoader();
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
   * Get REC recipients for a phone with Discord ID deduplication
   * Enhanced for Phase 3 VGCS integration - deduplicates by Discord ID while preserving phone information
   * @param {Phone} phone 
   * @returns {Phone[]} Array of unique recipient phones (by Discord ID)
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

    // Get neighbor phones (filter out null results from missing phones)
    const neighbourPhones = panel.neighbours
      .map(nb => this.getPhone(nb.simId + PhoneManager.PHONE_ID_SEPARATOR + nb.panelId))
      .filter(phone => phone !== undefined);

    phones.push(...neighbourPhones);
    
    // Include control phone if it has a Discord ID
    const control = this.phones.find(x => x.getId() === sim.id + PhoneManager.CONTROL_SUFFIX && x.getDiscordId() !== null);
    if(control) {
      phones.push(control);
    }

    // Phase 3 Enhancement: Deduplicate by Discord ID while preserving phone information
    // This ensures each player receives only one REC notification even if they have multiple phones
    const discordIdMap = new Map();
    const deduplicatedPhones = [];

    phones.forEach(phone => {
      if (phone) {
        const discordId = phone.getDiscordId();
        
        if (discordId) {
          // Phone has Discord ID - apply deduplication
          if (!discordIdMap.has(discordId)) {
            // First phone for this Discord ID - add it
            discordIdMap.set(discordId, phone);
            deduplicatedPhones.push(phone);
          } else {
            // Duplicate Discord ID - prefer the phone with higher priority
            const existingPhone = discordIdMap.get(discordId);
            const preferredPhone = this._selectPreferredPhoneForREC(existingPhone, phone);
            
            if (preferredPhone !== existingPhone) {
              // Replace with higher priority phone
              const index = deduplicatedPhones.findIndex(p => p === existingPhone);
              if (index !== -1) {
                deduplicatedPhones[index] = preferredPhone;
                discordIdMap.set(discordId, preferredPhone);
              }
            }
          }
        } else {
          // Phone has no Discord ID - include for backward compatibility
          deduplicatedPhones.push(phone);
        }
      }
    });

    console.log(chalk.green('getRECRecipientsForPhone'), 
      `Found ${phones.length} total recipients, ${deduplicatedPhones.length} unique by Discord ID for phone:`, phone.getId());
    
    return deduplicatedPhones;
  }

  /**
   * Select preferred phone for REC calls when multiple phones have same Discord ID
   * Priority: Control > Panel phones (alphabetical by panel ID for consistency)
   * @param {Phone} phone1 
   * @param {Phone} phone2 
   * @returns {Phone} The preferred phone
   * @private
   */
  _selectPreferredPhoneForREC(phone1, phone2) {
    // Prefer control phones over panel phones
    const isPhone1Control = phone1.getId().endsWith(PhoneManager.CONTROL_SUFFIX);
    const isPhone2Control = phone2.getId().endsWith(PhoneManager.CONTROL_SUFFIX);
    
    if (isPhone1Control && !isPhone2Control) return phone1;
    if (isPhone2Control && !isPhone1Control) return phone2;
    
    // If both are control or both are panel phones, prefer alphabetically first
    // This ensures consistent behavior across calls
    return phone1.getId().localeCompare(phone2.getId()) <= 0 ? phone1 : phone2;
  }

  /**
   * @param {string} phoneId 
   * @returns {(Phone | undefined)}
   */
  getPhone(phoneId) {
    // Handle string/number conversion for phone ID lookup
    return this.phones.find(p => 
      p.getId() === phoneId || 
      p.getId() === String(phoneId) || 
      String(p.getId()) === String(phoneId)
    );
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
    this.sendPhonebookUpdateToUser(player);
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
    this.sendPhonebookUpdateToUser(player);
    return true;
  }

  unassignPhonesForDiscordId(discordId) {
    const phones = this.getPhonesForDiscordId(discordId);
    phones.forEach(p => p.setPlayer(null));
    this.sendPhonebookUpdateToUser(discordId);
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
   * Get all phones for a specific simulation
   * @param {string} simId 
   * @returns {Phone[]}
   */
  getPhonesForSim(simId) {
    return this.phones.filter(phone => 
      phone.getId().startsWith(simId + PhoneManager.PHONE_ID_SEPARATOR)
    );
  }

  /**
   * @param {User} user 
   */
  sendPhonebookUpdateToUser(user) {
    const phones = this.getPhonesForDiscordId(user.discordId);
    phones.forEach((p) => { p.setSpeedDial(this.getSpeedDialForPhone(p)); p.setTrainsAndMobiles(this.getTrainsAndMobilesForPhone(p)) });
    const book = phones.map(p => p.getPhoneBook());
    if(user.socket) {
      user.socket.emit('phonebookUpdate', book);
    }
  }

  // ========== Location-based Methods for REC Calls ==========

  /**
   * Get the location for a specific phone
   * @param {string} phoneId 
   * @returns {Object|null} Location object with sim and panel properties, or null if not found
   */
  getPhoneLocation(phoneId) {
    const phone = this.getPhone(phoneId);
    if (!phone) {
      return null;
    }
    
    const location = phone.getLocation();
    if (!location) {
      return null;
    }
    
    return {
      sim: location.simId,
      panel: location.panelId
    };
  }

  /**
   * Find all phones in the same location (sim + panel)
   * @param {Object} location Location object with sim and panel properties
   * @returns {Phone[]} Array of phones in the same location
   */
  getPhonesInSameLocation(location) {
    if (!location || !location.sim || !location.panel) {
      return [];
    }
    
    return this.phones.filter(phone => {
      const phoneLocation = phone.getLocation();
      if (!phoneLocation) {
        return false;
      }
      
      return phoneLocation.simId === location.sim && 
             phoneLocation.panelId === location.panel;
    });
  }

  /**
   * Find phones in neighboring panels within the same simulation
   * @param {Object} location Location object with sim and panel properties
   * @returns {Phone[]} Array of phones in neighboring panels
   */
  getNeighboringPanelPhones(location) {
    if (!location || !location.sim || !location.panel) {
      return [];
    }
    
    // Find the simulation to get panel neighbor information
    const sim = this.sims.find(s => s.id === location.sim);
    if (!sim) {
      return [];
    }
    
    // Find the panel to get its neighbors
    const panel = sim.panels.find(p => p.id === location.panel);
    if (!panel || !panel.neighbours) {
      return [];
    }
    
    const neighboringPhones = [];
    
    // For each neighbor panel, find phones in that location
    panel.neighbours.forEach(neighbor => {
      if (neighbor.simId === location.sim && neighbor.panelId !== location.panel) {
        const neighborPhones = this.phones.filter(phone => {
          const phoneLocation = phone.getLocation();
          if (!phoneLocation) {
            return false;
          }
          
          return phoneLocation.simId === neighbor.simId && 
                 phoneLocation.panelId === neighbor.panelId;
        });
        
        neighboringPhones.push(...neighborPhones);
      }
    });
    
    return neighboringPhones;
  }

  /**
   * Find the control phone for a simulation
   * @param {string} simId The simulation ID
   * @returns {Phone|null} The control phone for the simulation, or null if not found
   */
  getControlPhoneForSim(simId) {
    if (!simId) {
      return null;
    }
    
    // Look for phone with control suffix pattern
    const controlPhoneId = simId + PhoneManager.PHONE_ID_SEPARATOR + 'control';
    let controlPhone = this.getPhone(controlPhoneId);
    
    // If not found with standard pattern, try alternative patterns
    if (!controlPhone) {
      // Try with _CONTROL suffix
      const altControlId = simId + PhoneManager.PHONE_ID_SEPARATOR + 'CONTROL';
      controlPhone = this.getPhone(altControlId);
    }
    
    // If still not found, look for any phone with "control" in the name for this sim
    if (!controlPhone) {
      controlPhone = this.phones.find(phone => {
        const phoneLocation = phone.getLocation();
        if (!phoneLocation || phoneLocation.simId !== simId) {
          return false;
        }
        
        const name = phone.getName().toLowerCase();
        return name.includes('control') || name.includes('centre') || name.includes('center');
      });
    }
    
    return controlPhone || null;
  }

  // ========== CallGroup Management Methods ==========

  /**
   * Load CallGroups from separate configuration for a simulation
   * @param {Simulation} sim The simulation to load groups for
   * @param {string} configName Configuration name to use (defaults to "default")
   */
  loadCallGroupsForSim(sim, configName = "default") {
    // Get phones available for this simulation
    const simPhones = this.getPhonesForSim(sim.id);
    
    // Create CallGroups using the CallGroupLoader
    const callGroups = this.callGroupLoader.createCallGroupsForSim(
      configName, 
      sim.id, 
      simPhones
    );
    
    // Add all created CallGroups to the manager
    callGroups.forEach(callGroup => {
      this.addCallGroup(callGroup);
    });
  }

  /**
   * Add a CallGroup to the manager
   * @param {CallGroup} callGroup 
   */
  addCallGroup(callGroup) {
    // Remove existing group with same ID
    this.callGroups = this.callGroups.filter(g => g.id !== callGroup.id);
    // Add new group
    this.callGroups.push(callGroup);
  }

  /**
   * Get a CallGroup by ID
   * @param {string} groupId 
   * @returns {CallGroup|null}
   */
  getCallGroup(groupId) {
    return this.callGroups.find(g => g.id === groupId) || null;
  }

  /**
   * Get all CallGroups for a simulation
   * @param {string} simId 
   * @returns {CallGroup[]}
   */
  getCallGroupsForSim(simId) {
    return this.callGroups.filter(g => g.simId === simId);
  }

  /**
   * Get all CallGroups of a specific type
   * @param {string} type - Group type (GROUP or REC)
   * @returns {CallGroup[]}
   */
  getCallGroupsByType(type) {
    return this.callGroups.filter(g => g.type === type);
  }

  /**
   * Remove all CallGroups for a simulation
   * @param {string} simId 
   */
  removeCallGroupsForSim(simId) {
    this.callGroups = this.callGroups.filter(g => g.simId !== simId);
  }

  /**
   * Update member status in all groups containing the phone
   * @param {string} phoneId 
   * @param {string} status 
   */
  updatePhoneStatusInGroups(phoneId, status) {
    this.callGroups.forEach(group => {
      if (group.includesPhone(phoneId)) {
        group.updateMemberStatus(phoneId, status);
      }
    });
  }

  /**
   * Get all groups that contain a specific phone
   * @param {string} phoneId 
   * @returns {CallGroup[]}
   */
  getGroupsContainingPhone(phoneId) {
    return this.callGroups.filter(group => group.includesPhone(phoneId));
  }

  /**
   * Create a predefined REC group for emergency calls
   * @param {string} simId 
   * @param {Phone[]} emergencyPhones - Phones that should be in the REC group
   * @returns {CallGroup}
   */
  createRECGroup(simId, emergencyPhones) {
    const members = emergencyPhones.map(phone => ({
      id: phone.getId(),
      name: phone.getName(),
      type: phone.toSimple().type,
      status: 'available'
    }));

    const recGroup = new CallGroup(
      `${simId}_REC_emergency`,
      'Railway Emergency Call Group',
      'Emergency response group for REC calls',
      CallGroup.TYPES.REC,
      simId,
      members
    );

    this.addCallGroup(recGroup);
    return recGroup;
  }
}
