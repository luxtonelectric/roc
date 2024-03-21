// @ts-check
import chalk from 'chalk'

import Phone from "./model/phone.js";
import Location from './model/location.js';
/** @typedef {import("socket.io").Server} Server */
/** @typedef {import("./model/simulation.js").default} Simulation */
/** @typedef {import("./model/phonebookentry.js").default} PhonebookEntry */

export default class PhoneManager {
  /** @type {Phone[]} */
  phones = [];

  /** @type {Simulation[]} */
  sims = []

  /**
   * 
   * @param {Server} io 
   */
  constructor(io) {
    this.io = io;
  }
  /**
   * 
   * @param {Simulation} sim 
   */
  generatePhonesForSim(sim) {
    //Create a phone for each panel in the sim.
    sim.panels.forEach((panel) => {
      this.phones.push(new Phone(panel.id, panel.name, Phone.TYPES.FIXED, new Location(sim.id, panel.id)));
    })

    //Create a phone for Control
    // TODO: Add ability to configure additional phones for the Sim.
    this.phones.push(new Phone(sim.id + "_control", 'Control', Phone.TYPES.FIXED, new Location(sim.id)));

    this.sims.push(sim)

    //console.log(chalk.yellow('generatePhonesForSim'), this.phones);
  }

  generatePhoneForTrain(train) {
    //TODO: This needs a lot of work!
    this.phones.push(new Phone(train, train, Phone.TYPES.TRAIN, train));
  }

  generatePhoneForPerson(number, name, type=Phone.TYPES.MOBILE, location = null, hidden=false) {
    if(!this.phones.some(p => p.id === number)) {
      this.phones.push(new Phone(number, name, type, location, hidden));
    }
  }

  /**
   * 
   * @param {Phone} phone 
   * @returns {PhonebookEntry[]}
   */
  getSpeedDialForPhone(phone) {
    let phones = [];
    const sim = this.sims.find(x => x.id === phone.location.simId);
    const neighbourPanels = sim.panels.filter(x => x.neighbours.some(n => n.panelId === phone.location.panelId));
    const neighbourPhones = this.phones.filter(x => neighbourPanels.find(y => y.id === x.id));
    phones = phones.concat(neighbourPhones);
    const control = this.phones.filter(x => x.id === sim.id + "_control");
    return phones.concat(control).map(p => p.toSimple());
  }

  /**
   * 
   * @param {Phone} phone 
   * @returns {PhonebookEntry[]}
   */
  getTrainsAndMobilesForPhone(phone) {
    const trainPhones = this.phones.filter(x => x.location.simId === phone.location.simId && x.type === Phone.TYPES.TRAIN).map(p => p.toSimple());
    const mobilePhones = this.phones.filter(x => x.location.simId === phone.location.simId && x.type === Phone.TYPES.MOBILE).map(p => p.toSimple());
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
    const sim = this.sims.find(x => x.id === phone.location.simId);
    const neighbourPanels = sim.panels.filter(x => x.neighbours.some(n => n.panelId === phone.location.panelId));
    const neighbourPhones = this.phones.filter(x => x.discordId !== null && neighbourPanels.find(y => y.id === x.id));
    phones = phones.concat(neighbourPhones);
    const control = this.phones.filter(x => x.id === sim.id + "_control" && x.discordId !== null);
    return phones.concat(control).map(p => p.toSimple());
  }

  /**
   * 
   * @param {string} phoneId 
   * @returns {(Phone | undefined)}
   */
  getPhone(phoneId) {
    return this.phones.find(x => x.id === phoneId);
  }

  assignPhone(phoneId, discordId) {
    const phone = this.phones.find(x => x.id === phoneId);
    if (typeof phone === 'undefined') {
      console.log(chalk.yellow('assignPhone'), 'Phone is undefined', phoneId, discordId);
      return false;
    }
    phone.discordId = discordId;
    return true;
  }

  unassignPhone(phoneId) {
    const phone = this.phones.find(x => x.id === phoneId);
    if (typeof phone === 'undefined') {
      console.log(chalk.yellow('assignPhone'), 'Phone is undefined', phoneId);
      return false;
    }
    phone.discordId = null;
    return true;
  }

  unassignPhonesForDiscordId(discordId) {
    const phones = this.getPhonesForDiscordId(discordId);
    phones.forEach(p => p.discordId = null);
  }

  getPhonesForDiscordId(discordId) {
    const phones = this.phones.filter(x => x.discordId === discordId);
    return phones;
  }
}