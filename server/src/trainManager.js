// @ts-check

/** @typedef {import("./model/trainLocationMessage.js").default} TrainLocationMessage */
/** @typedef {import("./phonemanager.js").default} PhoneManager */

import chalk from 'chalk';
import Train from "./model/train.js";
import Location from './model/location.js';
import ROCManager from './ROCManager.js';

export default class TrainManager{

  /** @type {Train[]} */
  #trains = [];

  /** @type {PhoneManager} */
  #phoneManager;

  /** @type {ROCManager} */
  #gameManager;

  setPhoneManager(phoneManager) {
    this.#phoneManager = phoneManager;
  }

  /**
   *
   * @param {ROCManager} gameManager
   */
  setGameManager(gameManager) {
    this.#gameManager = gameManager;
  }

  /**
   * @param {string} simId
   * @param {string} location
   */
  getPanelFromLocation(simId, location) {
    const sim = this.#gameManager.getSimById(simId);
    if (sim.panels.length === 1) {
      return sim.panels[0].id
    }
    return sim.getPanelByLocation(location)
  }

  /**
   * 
   * @param {TrainLocationMessage} message 
   */
  handleTrainLocationMessage(message) {
    console.log(chalk.magenta('handleTrainLocationMessage'), message.getSUID())
    const train = this.#trains.find(t => t.getSUID() === message.getSUID())
    if(train) {
      console.log('We know this train...')

      if(train.getHeadcode() !== message.getHeadcode()) {
        console.log('Headcode has changed updating train');
        train.setHeadcode(message.getHeadcode());
        const phone = train.getPhone();
        phone.setName(message.getHeadcode());
      }

      const panel = this.getPanelFromLocation(message.getSimId(), message.getLocation())
      if (panel && panel !== train.getLocation()?.panelId) {
        console.log(
          "setting location for",
          train.getHeadcode(),
          "suid",
          train.getSUID(),
          "because it reported at",
          message.getLocation(),
          "so its new panel is",
          panel
        );
        train.setLocation(new Location(message.getSimId(), panel))
      }

    } else {
      //TODO The train could have arrived from a chained sim and might not be new...
      this.addNewTrainFromMessage(message)
    }
  }

  /**
   * 
   * @param {TrainLocationMessage} message 
   */
  addNewTrainFromMessage(message) {
    const train = new Train(message.getSimId(),message.getUID(),message.getHeadcode());
    const phone = this.#phoneManager.generatePhoneForTrain(train);
    train.setPhone(phone);
    const panel = this.getPanelFromLocation(message.getSimId(), message.getLocation())
    train.setLocation(new Location(message.getSimId(), panel));
    this.#trains.push(train);
  }
}