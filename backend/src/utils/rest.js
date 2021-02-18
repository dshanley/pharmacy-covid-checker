const requestApi = require('request-promise');
const logger = require('./cc-logger').startLogging('rest-helper');

module.exports.request = async (method, url, data, headers, json=true) => {
  logger.debug(`Making request ${url}`);
  const accepted = ['GET', 'POST', 'PUT', 'DELETE'];
  if (accepted.indexOf(method) < 0) throw new Error('Your request method is not an accepted request method');
  // if (json === null) json = true; // eslint-disable-line no-param-reassign

  const options = {
    uri: url,
    json,
    method,
    resolveWithFullResponse: true,
    // auth: {
    //   user: process.env.SERVICE_USER,
    //   pass: process.env.SERVICE_SEC,
    // },
  };
  // make a form post
  if (method !== 'GET' && data && data.form) {
    options.form = data.form;
  }
  // regular post
  else if (method !== 'GET' && data) {
    options.body = data;
  }
  if (headers !== null) {
    options.headers = headers;
  }

  try {
    const { body, statusCode } = await requestApi(options);
    // const result = (typeof (body) === 'object') ? body : JSON.parse(body);
    if (statusCode !== 200) {
      logger.warning(`Warning: Response Status: ${statusCode}`);
    }
    return body;
  } catch (error) {
    logger.error(error);
    throw new Error(error);
  }

}

/**
 * Response wrapper 
 *
 * @param {int} status
 * @param {object} data
 * @param {string} endpointName
 * @throws {error} .
 * @returns {object} response
 */
module.exports.response = (status, data, endpointName) => {
  if (typeof status !== "number") status = parseInt(status, 10); // eslint-disable-line no-param-reassign
  const message = `Response for ${endpointName}.`;
  const res = {
    statusCode: status,
    headers: {
      "Access-Control-Allow-Origin": "*", // Required for CORS support to work
      "Access-Control-Allow-Credentials": true // Required for cookies, authorization headers with HTTPS
    },
    body: JSON.stringify({
      message,
      data
    }),
    isBase64Encoded: false
  };
  return res;
};