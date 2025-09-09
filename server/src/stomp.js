// @ts-check
import chalk from 'chalk';
import { Client, StompHeaders } from '@stomp/stompjs';
import { TCPWrapper } from '@stomp/tcp-wrapper';
import GameStompClient from './model/gameStompClient.js';
import TrainLocationMessage from './model/trainLocationMessage.js';
import Host, { InterfaceGateway } from './model/host.js';
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

  createClientForHost(host) {
    console.log('createClientForHost called for', host.sim);
    if (!host.enabled) {
      console.info(chalk.yellow('createClientForHost'), chalk.red("Host is disabled, skipping Interface Gateway setup for", host.sim));
      return false;
    }

    if (!host.interfaceGateway) {
      console.info(chalk.yellow('createClientForHost'), chalk.red("No Interface Gateway configuration for", host.host));
      return false;
    }

    let clientConnectHeaders = new StompHeaders();
    clientConnectHeaders.ack = 'auto';

    // Use new authentication from InterfaceGateway
    console.log('Checking authentication for', host.sim);
    if (host.interfaceGateway.hasAuthentication()) {
      console.log('Using authentication for', host.sim);
      const username = host.interfaceGateway.username;
      const password = host.interfaceGateway.getDecryptedPassword();
      if (username && password) {
        console.log(chalk.green('Using credentials to login as'), username);
        clientConnectHeaders.login = username;
        clientConnectHeaders.passcode = password;
      }
    }
    // Fallback to legacy authentication for backwards compatibility
    else if (host.interfaceGateway.login) {
      console.log(chalk.green('Using legacy credential to login'), host.interfaceGateway.login);
      clientConnectHeaders.login = host.interfaceGateway.login;
      clientConnectHeaders.passcode = host.interfaceGateway.password;
    }
    console.log('Client connect headers:', clientConnectHeaders);
    // Set initial state to disconnected
    host.interfaceGateway.connectionState = 'disconnected';
    host.interfaceGateway.errorMessage = null;
    this.gameManager.updateAdminUI();

    const client = new Client({
      connectHeaders: clientConnectHeaders,
      webSocketFactory: () => new TCPWrapper(host.host, host.interfaceGateway.port),
      onConnect: (iFrame) => {
        console.log("STOMP Connect");
        console.log(iFrame);
        host.interfaceGateway.connectionState = 'connected';
        host.interfaceGateway.errorMessage = null;
        this.gameManager.updateAdminUI();
        client.subscribe('/topic/SimSig', (message) => {
          const clockMessage = JSON.parse(message.body);
          if (clockMessage) {
            if ("clock_msg" in clockMessage) {
              this.gameManager.updateSimTime(clockMessage["clock_msg"]);
            }
          }
        }, { ack: 'auto' });
        client.subscribe('/topic/TRAIN_MVT_ALL_TOC', (rawMessage) => {
          const message = JSON.parse(rawMessage.body);
          if (message.train_location) {
            //console.log(`TRAIN_MVT_ALL_TOC:`, rawMessage.headers, message)
            try {
              this.trainManager.handleTrainLocationMessage(new TrainLocationMessage(host.sim, message))
            } catch (error) {
              console.error(chalk.redBright('TRAIN_MVT_ALL_TOC'), JSON.stringify(error, Object.getOwnPropertyNames(error)))
            }
          } else {
            //console.log('Ignoring train delay message');
          }
        }, { ack: 'auto' }
        );
      },
      onStompError: (frame) => {
        console.log(chalk.bgRed(host.sim), "STOMP StompError", frame.body);
        host.interfaceGateway.connectionState = 'error';
        host.interfaceGateway.errorMessage = frame.body;
        this.gameManager.updateAdminUI();
      },
      onWebSocketError: (event) => {
        console.log(chalk.bgRed(host.sim),"STOMP WebSocketError", event);
        host.interfaceGateway.connectionState = 'error';
        // Extract error message from the event
        let errorMessage = 'Unknown error';
        if (event.message && typeof event.message === 'object') {
          const msg = event.message;
          if (msg.code) {
            errorMessage = `${msg.code}`;
            if(msg.syscall) {
              errorMessage += ` (${msg.syscall})`;
            }
            if (msg.address && msg.port) {
              errorMessage += ` to ${msg.address}:${msg.port}`;
            }
          }
        } else if (event.message) {
          errorMessage = event.message;
        }
        host.interfaceGateway.errorMessage = errorMessage;
        this.gameManager.updateAdminUI();
      },
    });
    // client.debug = function (str) {
    //   console.log(str);
    // };

    console.info(chalk.yellow('createClientForHost'), chalk.white("Created Interface Gateway configuration for", host.host));
    if (host.interfaceGateway.enabled === true) {
      client.activate();
      console.info(chalk.yellow('createClientForHost'), host.host, chalk.white("Interface Gateway"), chalk.green('ACTIVATED'));
    } else {
      console.info(chalk.yellow('createClientForHost'), host.host, chalk.white("Interface Gateway"), chalk.red('DISABLED'));
    }

    this.clients.push(new GameStompClient(host.sim, host, client));
    return true;
  }

  // Legacy method for backward compatibility
  createClientForGame(game, port) {
    // Convert config object to Host instance if needed
    const host = (game instanceof Host) ? game : Host.fromConfig(game);
    return this.createClientForHost(host);
  }

  activateClientForGame(simId) {
    let gameClient = this.clients.find(c => c.id === simId)
    if (!gameClient) {
      const host = this.gameManager.getHostById(simId);
      if (!host) {
        throw new Error("No host configuration found for simulation");
      }
      this.createClientForHost(host);
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
      // Always deactivate the client when removing, regardless of enabled state
      // This ensures proper disconnection when disabling the interface gateway
      try {
        gameClient.client.deactivate();
        gameClient.game.interfaceGateway.connectionState = 'disconnected';
        gameClient.game.interfaceGateway.errorMessage = null;
      } catch (error) {
        console.error(chalk.red("Failed to deactivate Interface Gateway during removal:"), error);
        gameClient.game.interfaceGateway.connectionState = 'error';
        gameClient.game.interfaceGateway.errorMessage = error.message;
      }

      // Remove from clients array
      this.clients = this.clients.filter(c => c.id !== simId);
      this.gameManager.updateAdminUI();
    }
  }
}