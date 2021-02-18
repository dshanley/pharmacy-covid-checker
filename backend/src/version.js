const rest = require('./utils/rest');
// const logger = require('./cc-logger').startLogging('version');

// ////////////////////////////////////////////////////////////
// Version

const getServiceVersion = () => {
  const version = !process.env.version ? "unknown" : process.env.version;
  const versionInfo = {
    version,
    stage: process.env.stage,
    region: process.env.region,
    serviceName: process.env.serviceName
  }
  return versionInfo;
}

// ////////////////////////////////////////////////////////////
// Handler

const getServiceVersionHandler = async (event) => {
  const {path} = event;
  return rest.response(200, getServiceVersion(), path);
}

module.exports = {
  getServiceVersionHandler
}