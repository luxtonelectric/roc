// @ts-check
import chalk from 'chalk';
import { Client, StompHeaders } from '@stomp/stompjs';
import { TCPWrapper } from '@stomp/tcp-wrapper';
import GameStompClient from './model/gameStompClient.js';
import TrainLocationMessage from './model/trainLocationMessage.js';
/** @typedef {import("./trainManager.js").default} TrainManager */
/** @typedef {import("./phonemanager.js").default} PhoneManager */
/** @typedef {import("./ROCManager.js").default} ROCManager */

export default class STOMPManager {
  /** @type {ROCManager} */
  gameManager;
  /** @type {PhoneManager} */
  phoneManager;
  /** @type {GameStompClient[]} */
  clients = []
  /** @type {TrainManager} */
  trainManager

  constructor() {
    this.clients = [];
  }

  /**
   * 
   * @param {ROCManager} gameManager 
   */
  setGameManager(gameManager) {
    this.gameManager = gameManager;
  }

  /**
   * 
   * @param {TrainManager} trainManager 
   */
  setTrainManager(trainManager) {
    this.trainManager = trainManager;
  }

  createClientForGame(game) {
    if ("interfaceGateway" in game) {
      if (!("host" in game) || !("port" in game.interfaceGateway)) {
        console.error(chalk.yellow('createClientForSim'), chalk.red("Invalid Interface Gateway configuration for", game.id));
        return false;
      }

      let clientConnectHeaders = new StompHeaders();
      clientConnectHeaders.ack = 'auto';
      if(game.interfaceGateway.login) {
        console.log(chalk.green('Using credential to login'), game.interfaceGateway.login)
        clientConnectHeaders.login = game.interfaceGateway.login;
        clientConnectHeaders.passcode = game.interfaceGateway.password;
      }

      const client = new Client({
        connectHeaders: clientConnectHeaders,
        webSocketFactory: () => new TCPWrapper(game.host, game.interfaceGateway.port),
        onConnect: (iFrame) => {
          console.log("STOMP Connect");
          console.log(iFrame);
          game.interfaceGateway.connected = true;
          this.gameManager.updateAdminUI();
          client.subscribe('/topic/SimSig', (message) => {
            const clockMessage = JSON.parse(message.body);
            if (clockMessage) {
              if ("clock_msg" in clockMessage) {
                this.gameManager.updateSimTime(clockMessage["clock_msg"]);
              }
            }
          },{ack: 'auto'});
          client.subscribe('/topic/TRAIN_MVT_ALL_TOC', (rawMessage) => {
            const message = JSON.parse(rawMessage.body);
            if(message.train_location) {
              //console.log(`TRAIN_MVT_ALL_TOC:`, rawMessage.headers, message)
              try {
                this.trainManager.handleTrainLocationMessage(game.sim,new TrainLocationMessage(game.sim,message))
              } catch (error) {
                console.error(chalk.redBright('TRAIN_MVT_ALL_TOC'), JSON.stringify(error, Object.getOwnPropertyNames(error)))
              }
            } else {
              //console.log('Ignoring train delay message');
            }
          },{ack: 'auto'}
          );
        },
        onStompError: (frame) => {
          console.log("STOMP StompError", frame.body);
        },
        onWebSocketError: (event) => {
          console.log("STOMP WebSocketError", event);
          game.interfaceGateway.connected = false;
          this.gameManager.updateAdminUI()
        },
      });
      // client.debug = function (str) {
      //   console.log(str);
      // };

      console.info(chalk.yellow('createClientForGame'), chalk.white("Created Interface Gateway configuration for", game.host));
      if (game.interfaceGateway.enabled === true) {
        client.activate();
        console.info(chalk.yellow('createClientForGame'), game.host, chalk.white("Interface Gateway"), chalk.green('ACTIVATED'));
      } else {
        console.info(chalk.yellow('createClientForGame'), game.host, chalk.white("Interface Gateway"), chalk.red('DISABLED'));
      }

      this.clients.push(new GameStompClient(game.sim, game, client));

    } else {
      console.info(chalk.yellow('createClientForGame'), chalk.red("No Interface Gateway configuration for", game.host));
    }
  }

  activateClientForGame(simId) {
    const gameClient = this.clients.find(c => c.id === simId)
    if (gameClient) {
      gameClient.client.activate();
      gameClient.game.interfaceGateway.enabled = true;
      return true;
    }
    return false;
  }

  deactivateClientForGame(simId) {
    const gameClient = this.clients.find(c => c.id === simId)
    if (gameClient) {
      gameClient.client.deactivate();
      gameClient.game.interfaceGateway.enabled = false;
    }
  }
}