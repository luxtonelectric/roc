import chalk from 'chalk';
import { Client } from '@stomp/stompjs';
import { TCPWrapper } from '@stomp/tcp-wrapper';

export default class STOMPManager {
    constructor(gameManager) {
        this.gameManager = gameManager;
        this.clients = [];
    }
    
    load() {
        const gm = this.gameManager;

        for(const [key,sim] of Object.entries(this.gameManager.sims)) {
          this.createClientForSim(this.gameManager.sims[key]);
        }

    }
    
    createClientForSim(sim) {

      if("interfaceGateway" in sim){
        if(!("host" in sim.interfaceGateway) || !("port" in sim.interfaceGateway)) {
          console.error(chalk.yellow('createClientForSim'), chalk.red("Invalid Interface Gateway configuration for", sim.id));
          return false;
        }

        const client = new Client({
          webSocketFactory: () => new TCPWrapper(sim.interfaceGateway.host, sim.interfaceGateway.port),
          onBeforeConnect: () => {
              console.log("STOMP onBeforeConnect");
          },
          onConnect: () => {
            console.log("STOMP Connect");
            client.subscribe('/topic/SimSig', (message) => {
              const clockMessage = JSON.parse(message.body);
              if(typeof clockMessage !== 'undefined') {
                  if("clock_msg" in clockMessage) {
                      gm.updateSimTime(clockMessage["clock_msg"]);
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
        client.debug = function(str) {
          //console.log(str);
        };

        console.info(chalk.yellow('createClientForSim'), chalk.white("Created Interface Gateway configuration for", sim.id));
        if(sim.interfaceGateway.enabled === true) {
          client.activate();
          console.info(chalk.yellow('createClientForSim'), sim.id, chalk.white("Interface Gateway"), chalk.green('ACTIVATED'));
        } else {
          console.info(chalk.yellow('createClientForSim'), sim.id, chalk.white("Interface Gateway"), chalk.red('DISABLED'));
        }

        this.clients.push({id:sim.id, client: client});

      } else {
        console.info(chalk.yellow('createClientForSim'), chalk.red("No Interface Gateway configuration for", sim.name));
      }


    }
}