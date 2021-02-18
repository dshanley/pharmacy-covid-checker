// const { createLogger, format, transports, config } = require('winston');
const winston = require('winston');

const logLevel = () => {
  const debugPct = process.env.DEBUG_PCT || 100;
  let level = process.env.LOG_LEVEL || 'error';

  if (Math.floor(Math.random() * 100) + 1 <= debugPct) {
    level = 'debug'
  }
  return level;
}


 const startLogging = (service) => {
  return winston.createLogger({
    levels: winston.config.syslog.levels,
    level: logLevel(),
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.json(),
    ),
    transports: [
        new winston.transports.Console()
    ]
  }).child({service});
};

module.exports = {
  startLogging
};