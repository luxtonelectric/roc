/** @typedef {import("./model/train.js").default} Train */
/** @typedef {import("./model/trainLocationMessage.js").default} TrainLocationMessage */
/** @typedef {import("./phonemanager.js").default} PhoneManager */

import chalk from 'chalk';
import Train from "./model/train.js";
import Location from './model/location.js';

export default class TrainManager{

  /** @type {Train[]} */
  #trains = [];

  /** @type {PhoneManager} */
  #phoneManager;


  setPhoneManager(phoneManager) {
    this.#phoneManager = phoneManager;
  }

  /**
 * 
 * @param {string} simId 
 * @param {TrainLocationMessage} message 
 */
  handleTrainLocationMessage(simId, message) {
    console.log(chalk.magenta('handleTrainLocationMessage'), simId,message.getSUID())
    const train = this.#trains.find(t => t.getSUID() === message.getSUID())
    if(train) {
      console.log('We know this train...')

      if(train.getHeadcode() !== message.getHeadcode()) {
        console.log('Headcode has changed updating train');
        train.setHeadcode(message.getHeadcode());
        const phone = train.getPhone();
        phone.setName(message.getHeadcode());
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
    train.setLocation(new Location(message.getSimId()));
    this.#trains.push(train);
  }

}