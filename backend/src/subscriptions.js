const AWS = require('aws-sdk');
// const requestApi = require('request-promise');
// const ddb = require('./utils/dynamodb');
const logger = require('./utils/cc-logger').startLogging('pharms');
const rest = require('./utils/rest');
const constants = require('./constants');
const { SNS } = require('aws-sdk');

const snsClient = new AWS.SNS({region: process.env.region, apiVersion: '2010-03-31'});
const SNS_PROTOCOL_SMS = "sms";

// ///////////////////////////////////////////////////////////////////////////////////////////////////
// Topics

const createTopicForPharmacy = async (store) => {
  const functionName = "createTopicForPharmacy";

  if (!store.id) {
    logger.error({functionName, store, error: "store id expected"});
    throw new Error(error);
  }

  try {
    const params = {
      "Name": store.id,
      "Attributes": {
        "DisplayName": "VaccineNotifier.org",
      },
      Tags: [
        {
          "Key": "stage", 
          "Value": process.env.stage 
        },
        {
          "Key": "storeType", 
          "Value": store.storeType
        },
      ]
    };
    const response = await snsClient.createTopic(params).promise();
    logger.debug(response);

  } catch (error) {
    logger.error({functionName, store, error: error.toString()});
  }
}

// ///////////////////////////////////////////////////////////////////////////////////////////////////
// Subscriptions

/**
 * Subscribe a user to notifications. Write the Arn for the subscription to the contacts table.
 * @param {String} phoneMobile 
 * @param {String} storeKey 
 */
const subscribePersonToPharmacy = async (phoneMobile, storeKey) => {
  const functionName = "subscribePersonToPharmacy";

  if (!phoneMobile || !storeKey) {
    logger.error({functionName, error: "phoneMobile and storeKey required"});
    throw new Error("phoneMobile and storeKey required");
  }

  try {
    const snsTopicArn = `${process.env.snsTopicArnString}:${storeKey}`;
    const params = {
      Protocol: SNS_PROTOCOL_SMS,
      TopicArn: snsTopicArn,
      Endpoint: phoneMobile,
      ReturnSubscriptionArn: true
    };  
    logger.debug({functionName, params});
    let response = await snsClient.subscribe(params).promise();
    logger.debug({functionName, response});

    // update the contact record with the subscription data
    if (response && response.SubscriptionArn) {
      
      return response.SubscriptionArn;
    }

    return false;
  } catch (error) {
    logger.error({functionName, phoneMobile, storeKey, error: error.toString()});
    throw new Error(error);
  }
}

// ///////////////////////////////////////////////////////////////////////////////////////////////////
// Publish alert to topic

const alertAllToAvailabilityAtPharmacies = async (storesNowAvailable) => {
  const functionName = "alertAllToAvailabilityAtPharmacies";

  try {
    const smsBroadcasts = [];
    
    for (const store of storesNowAvailable) {
      const params = {
        Message: `Availability at RiteAid ${store.storeId}: ${store.address}`,
        TopicArn: `${process.env.snsTopicArnString}:${store.id}`
      };
      smsBroadcasts.push(snsClient.publish(params).promise().catch( error => {
        logger.error({functionName, store, error: error.toString()});
      }));
    }
    const response = await Promise.all(smsBroadcasts);
    logger.debug({functionName, response});

  } catch (error) {
    logger.error({functionName, storesNowAvailable, error: error.toString()});
    throw new Error(error);
  }
}

module.exports = {
  createTopicForPharmacy,
  subscribePersonToPharmacy,
  alertAllToAvailabilityAtPharmacies
};