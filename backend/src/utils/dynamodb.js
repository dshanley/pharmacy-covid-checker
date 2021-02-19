const AWS = require('aws-sdk'); // eslint-disable-line import/no-extraneous-dependencies
const logger = require('./cc-logger').startLogging('dynamodb-helper');


let options = {
	region: 'us-west-2'
};

// connect to local DB if running offline
if (process.env.IS_OFFLINE || process.env.NODE_ENV === "test") {
	options = {
		region: 'localhost',
		endpoint: 'http://localhost:8080',
		correctClockSkew: true,
	};
}

logger.debug({DDBOptions:options, env: process.env});

const client = new AWS.DynamoDB.DocumentClient(options);

module.exports = client;