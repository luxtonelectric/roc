// @ts-check
import chalk from 'chalk'

import Phone from "./model/phone.js";
import Location from './model/location.js';
import Panel from './model/panel.js';
import ROCManager from './ROCManager.js';
/** @typedef {import("socket.io").Server} Server */
/** @typedef {import("./model/simulation.js").default} Simulation */
/** @typedef {import("./model/phonebookentry.js").default} PhonebookEntry */
/** @typedef {import("./model/train.js").default} Train */
/** @typedef {import("./model/player.js").default} Player */

export default class PhoneManager {  
  /** @type {Phone[]} */
  phones = [];

  /** @type {Simulation[]} */
  sims = [];

  /**
   * 
   */
  constructor() {
  }
  /**
   * 
   * @param {Simulation} sim 
   */
  generatePhonesForSim(sim) {
    //Create a phone for each panel in the sim.
    sim.panels.forEach((panel) => {
      const phone = this.generatePhoneForPanel(sim, panel)
      console.log(chalk.yellow('generatePhonesForSim Added phone: '), phone.toAdminView());
      panel.phone = phone;
    })

    //Create a phone for Control
    // TODO: Add ability to configure additional phones for the Sim.
    this.phones.push(new Phone(sim.id + "_control", sim.name + ' Control', Phone.TYPES.FIXED, new Location(sim.id)));

    this.sims.push(sim)

    //console.log(chalk.yellow('generatePhonesForSim'), this.phones);
  }

  /**
   * 
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
   * 
   * @param {Simulation} sim
   * @param {Panel} panel 
   * @returns {Phone}
   */
  generatePhoneForPanel(sim, panel) {
    const phone = new Phone(sim.id +'_' + panel.id, sim.name + " " + panel.name, Phone.TYPES.FIXED, new Location(sim.id, panel.id))
    this.phones.push(phone);
    return phone;
  }

  /**
   * 
   * @param {string} number 
   * @param {string} name 
   * @param {string} type 
   * @param {Location} location 
   * @param {boolean} hidden 
   * @returns {Phone | undefined}
   */
  generatePhoneForPerson(number, name, type=Phone.TYPES.MOBILE, location = null, hidden=false) {
    console.log(chalk.yellow('generatePhoneForPerson'), arguments)
    if(number && !this.phones.some(p => p.getId() === number)) {
      console.log('created phone')
      const phone = new Phone(number, name, type, location, hidden)
      this.phones.push(phone);
      return phone;
    }else {
      throw new Error('Invalid number or number already exists');
    }
  }

  /**
   * 
   * @param {ROCManager} rocManager 
   */
  generateMissingNeighbourPhones(rocManager) {
    console.log(this)

    this.sims.forEach((sim) => sim.panels.forEach((p) => p.neighbours.forEach((neighbour) => {
      // Assume phones within the same sim are always generated together
      if (neighbour.simId !== sim.id) {
        const px = this.getPhone(neighbour.simId + "_" + neighbour.panelId);
        if (!px) {
          const neighbourSim = rocManager.getSimData(neighbour.simId, []);
          this.generatePhoneForPanel(neighbourSim, neighbourSim.getPanel(neighbour.panelId));
        }
      }
    })));
    console.log("Generated neighbour phones")
  }

  /**
   * 
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
          const neighbourPhones = panel.neighbours.map((nb) => {return this.getPhone(nb.simId + '_' + nb.panelId)},this);
          phones = phones.concat(neighbourPhones);
        }
        const control = this.phones.filter(x => x.getId() === sim.id + "_control" && x.getId() !== phone.getId());
        phones = phones.concat(control);
      }

    } else {
      console.log("Phone has no location");
    }

    return phones.map(p => p.toSimple());
  }

  /**
   * 
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
   * 
   * @param {Phone} phone 
   * @returns {Phone[]}
   */
  getRECRecipientsForPhone(phone) {
    let phones = [];
    
    // Find the location of the phone
    const sim = this.sims.find(s => s.id === phone.getLocation().simId);
    const panel = sim.getPanel(phone.getLocation().panelId);

    const neighbourPhones = panel.neighbours.map((nb) => {return this.getPhone(nb.simId + '_' + nb.panelId)},this);

    phones = phones.concat(neighbourPhones);
    console.log(chalk.redBright('REC neighbourphones'), neighbourPhones.length, neighbourPhones);
    
    // Include control
    const control = this.phones.find(x => x.getId() === sim.id + "_control" && x.getDiscordId() !== null);
    if(control) {
      phones = phones.concat(control)
      console.log(chalk.redBright('REC phones'), control.toSimple());
    }
    
    return phones;
  }

  /**
   * 
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
   * 
   * @param {Phone} phone 
   * @param {Player} player 
   * @returns 
   */
  assignPhone(phone, player) {
    if (typeof phone === 'undefined') {
      console.log(chalk.yellow('assignPhone'), 'Phone is undefined');
      return false;
    }
    phone.setPlayer(player);
    this.sendPhonebookUpdateToPlayer(player);
    return true;
  }

  /**
   * 
   * @param {Phone} phone 
   * @returns 
   */
  unassignPhone(phone) {
    if (typeof phone === 'undefined') {
      console.log(chalk.yellow('assignPhone'), 'Phone is undefined');
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
   * 
   * @param {string} discordId 
   * @returns 
   */
  getPhonesForDiscordId(discordId) {
    const phones = this.phones.filter(p => p.getDiscordId() === discordId);
    return phones;
  }

  /**
   * 
   * @param {Player} player 
   */
  sendPhonebookUpdateToPlayer(player) {
    const phones = this.getPhonesForDiscordId(player.discordId);
    phones.forEach((p) => { p.setSpeedDial(this.getSpeedDialForPhone(p)); p.setTrainsAndMobiles(this.getTrainsAndMobilesForPhone(p)) });
    const book = phones.map(p => p.getPhoneBook());
    if(player.socket) {
      console.log('Sending phonebook update', book);
      player.socket.emit('phonebookUpdate', book);
    } else {
      console.log(chalk.magenta('sendPhonebookUpdateToPlayer'), 'No socket for player', player.discordId)
    }
  }
}