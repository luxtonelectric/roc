// Begin Better logger
const chalk = require('chalk');
require('better-logging')(console, {
  format: ctx => `${ctx.date}${ctx.time24}${ctx.type}e${ctx.STAMP('ROCManager.js', chalk.blueBright)} ${ctx.msg}`
});
// End Better Logger


const port = 3001;
const config = require('./config.json');
const DiscordBot = require('./bot');
let io = require('socket.io')(port, {
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


let ROCManager = require('./ROCManager.js');
const discordBot = new DiscordBot(config.token, config.prefix, config.guild);
const rocManager = new ROCManager(io, discordBot, config);
discordBot.setGameManager(rocManager);


io.on('connection', (socket) => {
  console.info(chalk.blueBright("SocketIO Connection"), chalk.yellow("Users connected:"), chalk.white(io.sockets.sockets.size));
  require('./sockets')(socket, rocManager);
  require('./adminSockets')(socket, rocManager, config);
});