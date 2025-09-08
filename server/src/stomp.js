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
    this.trainManager.setGameManager(gameManager);
  }

  /**
   * 
   * @param {TrainManager} trainManager 
   */
  setTrainManager(trainManager) {
    this.trainManager = trainManager;
  }

  createClientForGame(game, port) {
    if (!game.enabled) {
      console.info(chalk.yellow('createClientForGame'), chalk.red("Host is disabled, skipping Interface Gateway setup for", game.sim));
      return false;
    }

    if ("interfaceGateway" in game) {
      if (!("host" in game) || !port) {
        console.error(chalk.yellow('createClientForSim'), chalk.red("Invalid Interface Gateway configuration for", game.id));
        return false;
      }

      let clientConnectHeaders = new StompHeaders();
      clientConnectHeaders.ack = 'auto';
      
      // Use new authentication from InterfaceGateway
      if(game.interfaceGateway.hasAuthentication && game.interfaceGateway.hasAuthentication()) {
        const username = game.interfaceGateway.username;
        const password = game.interfaceGateway.getDecryptedPassword();
        if (username && password) {
          console.log(chalk.green('Using credentials to login as'), username);
          clientConnectHeaders.login = username;
          clientConnectHeaders.passcode = password;
        }
      } 
      // Fallback to legacy authentication for backwards compatibility
      else if(game.interfaceGateway.login) {
        console.log(chalk.green('Using legacy credential to login'), game.interfaceGateway.login);
        clientConnectHeaders.login = game.interfaceGateway.login;
        clientConnectHeaders.passcode = game.interfaceGateway.password;
      }

      // Set initial state to disconnected
      game.interfaceGateway.connectionState = 'disconnected';
      game.interfaceGateway.errorMessage = null;
      this.gameManager.updateAdminUI();

      const client = new Client({
        connectHeaders: clientConnectHeaders,
        webSocketFactory: () => new TCPWrapper(game.host, port),
        onConnect: (iFrame) => {
          console.log("STOMP Connect");
          console.log(iFrame);
          game.interfaceGateway.connectionState = 'connected';
          game.interfaceGateway.errorMessage = null;
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
                this.trainManager.handleTrainLocationMessage(new TrainLocationMessage(game.sim,message))
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
          game.interfaceGateway.connectionState = 'error';
          game.interfaceGateway.errorMessage = frame.body;
          this.gameManager.updateAdminUI();
        },
        onWebSocketError: (event) => {
          console.log("STOMP WebSocketError", event);
          game.interfaceGateway.connectionState = 'error';
          // Extract error message from the event
          let errorMessage = 'Unknown error';
          if (event.message && typeof event.message === 'object') {
            const msg = event.message;
            if (msg.code && msg.syscall) {
              errorMessage = `${msg.code} (${msg.syscall})`;
              if (msg.address && msg.port) {
                errorMessage += ` to ${msg.address}:${msg.port}`;
              }
            }
          } else if (event.message) {
            errorMessage = event.message;
          }
          game.interfaceGateway.errorMessage = errorMessage;
          this.gameManager.updateAdminUI();
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
    let gameClient = this.clients.find(c => c.id === simId)
    if (!gameClient) {
      const game = this.gameManager.config.games.find(g => g.sim === simId);
      if (!game) {
        throw new Error("No host configuration found for simulation");
      }
      this.createClientForGame(game, game.interfaceGateway.port);
      const newClient = this.clients.find(c => c.id === simId);
      if (!newClient) {
        throw new Error("Failed to create Interface Gateway client");
      }
      gameClient = newClient;
    }

    try {
      gameClient.game.interfaceGateway.connectionState = 'connecting';
      this.gameManager.updateAdminUI();
      gameClient.client.activate();
      gameClient.game.interfaceGateway.enabled = true;
      return true;
    } catch (error) {
      console.error(chalk.red("Failed to activate Interface Gateway:"), error);
      gameClient.game.interfaceGateway.connectionState = 'error';
      gameClient.game.interfaceGateway.errorMessage = error.message;
      this.gameManager.updateAdminUI();
      throw new Error(`Failed to activate Interface Gateway: ${error.message}`);
    }
  }

  deactivateClientForGame(simId) {
    const gameClient = this.clients.find(c => c.id === simId)
    if (gameClient) {
      try {
        gameClient.client.deactivate();
        gameClient.game.interfaceGateway.enabled = false;
        gameClient.game.interfaceGateway.connectionState = 'disconnected';
        gameClient.game.interfaceGateway.errorMessage = null;
      } catch (error) {
        console.error(chalk.red("Failed to deactivate Interface Gateway:"), error);
        gameClient.game.interfaceGateway.connectionState = 'error';
        gameClient.game.interfaceGateway.errorMessage = error.message;
        throw new Error(`Failed to deactivate Interface Gateway: ${error.message}`);
      }
      this.gameManager.updateAdminUI();
    }
  }

  removeClientForGame(simId) {
    const gameClient = this.clients.find(c => c.id === simId);
    if (gameClient) {
      // Make sure it's deactivated first
      if (gameClient.game.interfaceGateway.enabled) {
        this.deactivateClientForGame(simId);
      }
      
      // Remove from clients array
      this.clients = this.clients.filter(c => c.id !== simId);
    }
  }
}