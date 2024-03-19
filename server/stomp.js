// @ts-check
import chalk from 'chalk';
import { Client } from '@stomp/stompjs';
import { TCPWrapper } from '@stomp/tcp-wrapper';
/** @typedef {import("./ROCManager.js").default} ROCManager */

export default class STOMPManager {
  /** @type {ROCManager} */
  gameManager;
  clients = []
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

  createClientForGame(game) {
    if ("interfaceGateway" in game) {
      if (!("host" in game) || !("port" in game.interfaceGateway)) {
        console.error(chalk.yellow('createClientForSim'), chalk.red("Invalid Interface Gateway configuration for", game.id));
        return false;
      }

      const client = new Client({
        webSocketFactory: () => new TCPWrapper(game.host, game.interfaceGateway.port),
        onConnect: () => {
          console.log("STOMP Connect");
          client.subscribe('/topic/SimSig', (message) => {
            const clockMessage = JSON.parse(message.body);
            if (typeof clockMessage !== 'undefined') {
              if ("clock_msg" in clockMessage) {
                this.gameManager.updateSimTime(clockMessage["clock_msg"]);
              }
            }
          });
          client.subscribe('/topic/TRAIN_MVT_ALL_TOC', message =>
            console.log(`TRAIN_MVT_ALL_TOC: ${message.body}`)
          );
        },
        onStompError: (frame) => {
          console.log("STOMP StompError", frame);
        },
        onWebSocketError: (event) => {
          console.log("STOMP WebSocketError", event);
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

      this.clients.push({ id: game.sim, client: client });

    } else {
      console.info(chalk.yellow('createClientForGame'), chalk.red("No Interface Gateway configuration for", game.host));
    }


  }
}