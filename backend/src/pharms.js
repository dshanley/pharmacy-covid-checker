const requestApi = require('request-promise');
const ddb = require('./utils/dynamodb');
const utils = require('./utils/dbMethods');
const logger = require('./utils/cc-logger').startLogging('pharms');
const rest = require('./utils/rest');
const subscriptions = require('./subscriptions');
const constants = require('./constants');




// ///////////////////////////////////////////////////////////////////////////////////////////////////
// Check Sites

const getValidVaccineSites = async (zipcode) => {
  const functionName = "getValidVaccineSites";

  try {
    // RITEAID
    // get the sites near a zipcode
    const sitesUrl = `https://www.riteaid.com/services/ext/v2/stores/getStores?address=${zipcode}&attrFilter=PREF-112&fetchMechanismVersion=2&radius=50`
    const response = await rest.request("GET", sitesUrl);
    if (!response || !response.Data || !response.Data.stores || response.Data.stores.length === 0) {
      logger.info("No stores data");
      return { riteAid: [] };
    }
    const storeIds = response.Data.stores.map(s => {
      return {
        storeId: `${s.storeNumber}`,
        address: `${s.address}, ${s.city} ${s.zipcode}`
      }
    });
    logger.debug({functionName, storeIds});
    
    return { riteAid: storeIds };
    
  } catch (error) {
    console.log({functionName, error: error.toString()});
    throw new Error(error);
  }
}

// ///////////////////////////////////////////////////////////////////////////////////////////////////
// Subscribe

/**
 * info of the form:
 * {
 *  phone,
 *  pharmacies: {
 *    riteAid: [ { storeId, address}, ... ]
 *  }
 * }
 * @param {Object} subscriptionInfo 
 */
const subscribeToNotificationsByPharmacy = async (subscriptionInfo) => {
  const functionName = "subscribeToNotificationsByPharmacy";

  const { phone, pharmacies } = subscriptionInfo;
  if (!phone || !pharmacies) {
    throw new Error("phone and subscription info is required");
  }

  try {
    // first save pharmacy as one we're checking
    // if it's not already in DB
    const {riteAid} = pharmacies;
    logger.debug({functionName, subscriptionInfo});
    if (riteAid && riteAid.length > 0) {
      const storeIds = [];
      const storeInserts = [];
      const createTopics = [];
      for (const store of riteAid) {
        const storeRecord = {
          id: `${constants.BRAND.RITEAID_STORE}-${store.storeId}`,
          isAvailable: 0,
          storeId: store.storeId,
          address: store.address,
          storeType: constants.BRAND.RITEAID_STORE,
          createAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        const params = {
          TableName: process.env.tablePharms,
          Item: {
            ...storeRecord
          },
          ConditionExpression: 'attribute_not_exists(id)'
        };
        storeIds.push(store.storeId);
        storeInserts.push(ddb.put(params).promise().catch( error => {
          if (error.code === 'ConditionalCheckFailedException') {
            logger.info({functionName, info: "store has already been added"});
            return;
          }
          logger.error({functionName, error: error.toString()});
        }));
        // create SNS SMS topic
        createTopics.push(subscriptions.createTopicForPharmacy(storeRecord));
      }
      // do the inserts
      const response = await Promise.all(storeInserts);
      await Promise.all(createTopics);
     
      // subscribe the user for notifications
      const userInfo = {
        phone,
        riteAid: storeIds
      }
      
      const userResponse = await subscribePersonToPharmacies(userInfo);
      logger.debug({functionName, userResponse, info: "added user sub"});
    }
    


  } catch (error) {
    logger.error({functionName, subscriptionInfo, error: error.toString()});
    throw new Error(error)
  }
}

/**
 * Subscribe the user to store vaccine notifications
 * info of the format: 
 * {
 *  phone,
 *  riteAid: [ 124, 456, 789 ]
 * }
 * @param {Object} userInfo 
 */
const subscribePersonToPharmacies = async (userInfo) => {
  const functionName = "subscribePersonToPharmacies";
  const { phone, riteAid } = userInfo;

  if (!riteAid || riteAid.length === 0) {
    logger.error({functionName, userResponse, error: "riteAid expected"});
    throw new Error("Set of stores expected");
  }

  try {
    // subscribe the user to sms alerts
    // we do this first to update contact record with Arns
    const smsSubscriptions = riteAid.map( storeId => {
      return subscriptions.subscribePersonToPharmacy(phone, `${constants.BRAND.RITEAID_STORE}-${storeId}`).catch( error => {
        logger.error({functionName, error: error.toString()});
      });
    });
    let subscriptionArns = await Promise.all(smsSubscriptions);
    subscriptionArns = utils.clean(subscriptionArns);
    logger.debug({functionName, subscriptionArns});

    // then, create contact for the user
    const updateParams = {
      TableName: process.env.tableContacts,
      Key: {
        phoneMobile: phone,
      },
      UpdateExpression: "SET updatedAt = :updatedAt, riteAidStores = :riteAidStores, subscriptionArns = :subscriptionArns, isEnabled = :isEnabled",
      ExpressionAttributeValues: {
        ':updatedAt': new Date().toISOString(),
        ':riteAidStores': ddb.createSet(userInfo.riteAid),
        ':subscriptionArns': ddb.createSet(subscriptionArns),
        ':isEnabled': 1
      },
      ReturnValues: "ALL_NEW"
    }
    const response = await ddb.update(updateParams).promise();
    logger.debug({functionName, response});

    // add subscriptions
    // N records -- one for each store
    const subscriptionInserts = [];
    for (const storeId of riteAid) {
      const subParams = {
        TableName: process.env.tableSubscriptions,
        Key: {
          storeKey: `${constants.BRAND.RITEAID_STORE}-${storeId}`,
          phoneMobile: phone
        },
        UpdateExpression: "SET updatedAt = :updatedAt",
        ExpressionAttributeValues: {
          ':updatedAt': new Date().toISOString(),
        },
        ReturnValues: "ALL_NEW"
      };
      subscriptionInserts.push(ddb.update(subParams).promise().catch( error => {
        logger.error({functionName, error: error.toString()});
      }))
    }
    const subsResponse = await Promise.all(subscriptionInserts);
    logger.debug({functionName, subsResponse});

    return subsResponse;
  } catch (error) {
    logger.error({functionName, error: error.toString()});
    throw new Error(error);
  }
}

// ///////////////////////////////////////////////////////////////////////////////////////////////////
// Handler

/**
 * Get the pharmacies given a zipcode
 * @param {Object} event 
 */
const getPharmaciesByZipcodeHandler = async (event) => {
  const thisEndPoint = "GET /notifier/v1/pharmacies?zipcode=";
  const {zipcode} = event.queryStringParameters;
  try {
    logger.debug({ thisEndPoint, zipcode });
    validStores = await getValidVaccineSites(zipcode);
    const response = {
      pharmacies: {
        ...validStores
      }
    };
    return rest.response(200, response, thisEndPoint);
  } catch (error) {
    logger.error({ thisEndPoint, zipcode, error: error.toString() });
    return rest.response(500, "Internal Server Error", thisEndPoint);
  }
};

/**
 * Subscribe to notifications when vaccine is available at given pharmacies
 * payload of the format: 
 * {
 *  phone: xxx.xxx.xxx // assumed US format, no country code
 *  pharmacies: {
 *    riteAid: [ { storeId, address }, { storeId, address } ]
 *  }
 * }
 * @param {Object} event 
 */
const subscribeToNotifications = async (event) => {
  const thisEndPoint = "POST /notifier/v1/subscribe";
  try {
    const subscriptionInfo = JSON.parse(event.body);
    logger.debug({ thisEndPoint, subscriptionInfo });
    // SNS SMS wants country code
    subscriptionInfo.phone = `+1${subscriptionInfo.phone}`;
    let response = await subscribeToNotificationsByPharmacy(subscriptionInfo);
    
    return rest.response(200, "Success", thisEndPoint);
  } catch (error) {
    logger.error({ thisEndPoint, error: error.toString() });
    return rest.response(500, "Internal Server Error", thisEndPoint);
  }
};

module.exports = {
  getPharmaciesByZipcodeHandler,
  subscribeToNotifications
}
