const AWS = require('aws-sdk');
// const requestApi = require('request-promise');
// const ddb = require('./utils/dynamodb');
const to = require('await-to-js').default;
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
      "Name": `${process.env.stage}-${store.id}`,
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
    // SNS needs composite key to identify stage
    const subscriptionKey = `${process.env.stage}-${storeKey}`;
    const snsTopicArn = `${process.env.snsTopicArnString}:${subscriptionKey}`;
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
      return {subscriptionArn: response.SubscriptionArn, subscriptionKey};
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

  if (!storesNowAvailable && storesNowAvailable.length === 0) {
    logger.debug({functionName, storesNowAvailable});
    return false;
  }

  try {
    const smsBroadcasts = [];
    
    for (const store of storesNowAvailable) {
      if (store) {
        const params = {
          Message: `Availability at RiteAid ${store.storeId}: ${store.address}. ${constants.BRAND.RITEAID_URL}`,
          TopicArn: `${process.env.snsTopicArnString}:${process.env.stage}-${store.id}`
        };
        logger.info({functionName, store, params});
        smsBroadcasts.push(snsClient.publish(params).promise().catch( error => {
          logger.error({functionName, store, error: error.toString()});
        }));
      }
    }
    const response = await Promise.all(smsBroadcasts);
    logger.debug({functionName, response});

  } catch (error) {
    logger.error({functionName, storesNowAvailable, error: error.toString()});
    throw new Error(error);
  }
}

/**
 * Update the user with their SMS subscription state
 * @param {String} phoneMobile 
 * @param {BOOL} subscribe 
 */
const alertSubscriptionState = async (phoneMobile, subscribe = true) => {
  const functionName = "alertSubscriptionState";

  try {
    const message = subscribe === true ? "We'll notify you when pharmacies have availability." : "You are unsubscribed and will not receive notifications."
    const params = {
      Message: `${constants.SUBSCRIPTION.DISPLAY_NAME}> ${message}`,
      PhoneNumber: phoneMobile
    };
    await to(snsClient.publish(params).promise());
  } catch (error) {
    logger.error({functionName, phoneMobile, error: error.toString()});
    throw new Error(error);
  }
}

// ///////////////////////////////////////////////////////////////////////////////////////////////////
// Utils

const adminDeleteAllTopics = async () => {
  const functionName = "adminDeleteAllTopics";

  try {
    let response = await snsClient.listTopics().promise();
    logger.debug({functionName, response});
    if (response && response.Topics) {
      const topicDeletions = []
      for (const topic of response.Topics) {
        const params = {
          "TopicArn": topic.TopicArn
        };
        if (topic.TopicArn.includes(constants.BRAND.RITEAID_STORE)) {
          topicDeletions.push(snsClient.deleteTopic(params).promise().catch(error => {
            logger.error({functionName, topic, error: error.toString()});
          }));
        }
      }
      response = await Promise.all(topicDeletions);
      logger.debug({functionName, response});
    }
  } catch (error) {
    logger.error({functionName, stage: process.env.stage, error: error.toString()});
    throw new Error(error);
  }
}

const adminDeleteAllSubscriptions = async () => {
  const functionName = "adminDeleteAllSubscriptions";

  try {
    let response = await snsClient.listSubscriptions().promise();
    logger.debug({functionName, response});
    if (response && response.Subscriptions) {
      const subDeletions = []
      for (const sub of response.Subscriptions) {
        const params = {
          "SubscriptionArn": sub.SubscriptionArn
        };
        if (sub.TopicArn.includes(constants.BRAND.RITEAID_STORE)) {
          subDeletions.push(snsClient.unsubscribe(params).promise().catch(error => {
            logger.error({functionName, sub, error: error.toString()});
          }));
        }
      }
      response = await Promise.all(subDeletions);
      logger.debug({functionName, response});
    }
  } catch (error) {
    logger.error({functionName, stage: process.env.stage, error: error.toString()});
    throw new Error(error);
  }
}

module.exports = {
  createTopicForPharmacy,
  subscribePersonToPharmacy,
  alertAllToAvailabilityAtPharmacies,
  alertSubscriptionState,
  // adminDeleteAllTopics,
  // adminDeleteAllSubscriptions
};