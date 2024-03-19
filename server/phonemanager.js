// @ts-check
import chalk from 'chalk';

import Phone from "./model/phone.js";
import Simulation from './model/simulation.js';
import Location from './model/location.js';
import { Server } from 'socket.io';
import PhonebookEntry from './model/phonebookentry.js';


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
            this.phones.push(new Phone(panel.id,panel.name,Phone.TYPES.FIXED,new Location(sim.id, panel.id)));
        })

        //Create a phone for Control
        // TODO: Add ability to configure additional phones for the Sim.
        this.phones.push(new Phone(sim.id+"_control",'Control',Phone.TYPES.FIXED,new Location(sim.id)));

        this.sims.push(sim)

        //console.log(chalk.yellow('generatePhonesForSim'), this.phones);
    }

    generatePhoneForTrain(train) {
        //TODO: This needs a lot of work!
        this.phones.push(new Phone(train,train,Phone.TYPES.TRAIN,train));
    }

    generatePhoneForPerson(number,name,location) {
        this.phones.push(new Phone(number,name,Phone.TYPES.MOBILE,location));
    }

    /**
     * 
     * @param {Phone} phone 
     * @returns {PhonebookEntry[]}
     */
    getSpeedDialForPhone(phone) {
        const simPhones = this.phones.filter(x=>x.location.simId === phone.location.simId && x.type === Phone.TYPES.FIXED && x.id !== phone.id).map(p => p.toSimple());
        //const control = this.phones.filter(x => x.id === phone.location.simId+"_control");
        return simPhones;
    }

    /**
     * 
     * @param {Phone} phone 
     * @returns {PhonebookEntry[]}
     */
    getTrainsAndMobilesForPhone(phone) {
        const trainPhones = this.phones.filter(x=>x.location.simId === phone.location.simId && x.type === Phone.TYPES.TRAIN).map(p => p.toSimple());
        const mobilePhones = this.phones.filter(x=>x.location.simId === phone.location.simId && x.type === Phone.TYPES.MOBILE).map(p => p.toSimple());
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
        console.log(chalk.magenta('getRECRecipientsForPhone'), phone, phones.length)
        const sim = this.sims.find(x=>x.id === phone.location.simId);
        console.log(chalk.magenta('getRECRecipientsForPhone'), sim, phones.length)
        const neighbourPanels = sim.panels.filter(x => x.neighbours.some(n => n.panelId === phone.location.panelId));
        console.log(chalk.magenta('getRECRecipientsForPhone'), neighbourPanels, phones.length)
        const neighbourPhones = this.phones.filter(x => x.discordId !== null && neighbourPanels.find(y => y.id === x.id));
        phones = phones.concat(neighbourPhones);
        console.log(chalk.magenta('getRECRecipientsForPhone'), neighbourPhones, phones.length)
        const control = this.phones.filter(x => x.id === sim.id+"_control" && x.discordId !== null);
        console.log(chalk.magenta('getRECRecipientsForPhone'), control, phones.length)
        return phones.concat(control);
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
        if(typeof phone === 'undefined') {
            console.log(chalk.yellow('assignPhone'), 'Phone is undefined', phoneId,discordId);
            return false;
        }
        phone.discordId = discordId;
        return true;
    }

    unassignPhone(phoneId) {
        const phone = this.phones.find(x => x.id === phoneId);
        if(typeof phone === 'undefined') {
            console.log(chalk.yellow('assignPhone'), 'Phone is undefined', phoneId);
            return false;
        }
        phone.discordId = null;
        return true;
    }

    getPhonesForDiscordId(discordId){
        const phones = this.phones.filter(x => x.discordId === discordId);
        return phones;
      }
}