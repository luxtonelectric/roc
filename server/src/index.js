//@ts-check
import betterLogging from 'better-logging';
import chalk from 'chalk';
betterLogging(console,{
  format: ctx => `${ctx.date}${ctx.time}${ctx.type}${ctx.STAMP('ROC', chalk.blueBright)} ${ctx.msg}`
});
import { readFileSync } from "fs";
import { createServer as createSecureServer} from "https";
import { createServer } from "http";
import { Server } from "socket.io";
import ROCManager from "./ROCManager.js";
import DiscordBot from "./bot.js";
// @ts-expect-error: with json is experimental
import config from "./../config.json" with { type: "json" };

import { rocSockets } from './sockets.js';
import { adminSockets } from './adminSockets.js';
import STOMPManager from './stomp.js';
import PhoneManager from './phonemanager.js';
import CallManager from './callManager.js';
import TrainManager from './trainManager.js';
import SimulationLoader from './services/SimulationLoader.js';
import ConfigurationManager from './services/ConfigurationManager.js';

let httpServer;

if(typeof config.server.ssl !== 'undefined') {
  console.log(chalk.greenBright("HTTPS MODE ENABLED: Using certificate..."));
  httpServer = createSecureServer({
    key: readFileSync(config.server.ssl.key),
    cert: readFileSync(config.server.ssl.cert)
  });
} else {
  console.log(chalk.greenBright("STARTING HTTP SERVER"));
  httpServer = createServer();
}

const port = config.server.port;


const io = new Server(httpServer,{
  'pingTimeout': 7000,
  'pingInterval': 3000,
  cors: {
    origin: config.corsOrigin
  },
  connectionStateRecovery: {
    // the backup duration of the sessions and the packets
    maxDisconnectionDuration: 2 * 60 * 1000,
    // whether to skip middlewares upon successful recovery
    skipMiddlewares: true,
  }
});

httpServer.listen(port);
console.log(chalk.greenBright("Server started and listening on port", port));

const discordBot = new DiscordBot(config.token, config.prefix, config.guild);
const simulationLoader = new SimulationLoader();
const configurationManager = new ConfigurationManager();
const phoneManager = new PhoneManager(simulationLoader);
const trainManager = new TrainManager();
trainManager.setPhoneManager(phoneManager);
const stompManager = new STOMPManager();
stompManager.setTrainManager (trainManager);
const callManager = new CallManager(phoneManager,discordBot,io);
const rocManager = new ROCManager(io, discordBot, phoneManager, stompManager, simulationLoader, configurationManager);
rocManager.load(config);

await discordBot.setUpBot().then(() => {
  console.log("Configuring voice channels");
  discordBot.configureVoiceChannels()
});

io.on('connection', (socket) => {
  console.info(chalk.blueBright("SocketIO Connection"), chalk.yellow("Users connected:"), chalk.white(io.sockets.sockets.size));
  rocSockets(socket, rocManager,callManager);
  adminSockets(socket, rocManager, phoneManager,config);
});


process.on('SIGINT', signal => {
  console.log(`Process ${process.pid} has been interrupted with`, signal)
  process.exit(0)
})
