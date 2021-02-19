const requestApi = require('request-promise');
const { error } = require('winston');
const ddb = require('./utils/dynamodb');
const logger = require('./utils/cc-logger').startLogging('pharms');
const rest = require('./utils/rest');

const BRAND = {
  RITEAID_STORE: "riteaid"
};


// ///////////////////////////////////////////////////////////////////////////////////////////////////
// Check Sites

const getValidVaccineSites = async (zipcode) => {
  const functionName = "getValidVaccineSites";

  try {
    // RITEAID
    // get the sites near a zipcode
    const sitesUrl = `https://www.riteaid.com/services/ext/v2/stores/getStores?address=${zipcode}&attrFilter=PREF-112&fetchMechanismVersion=2&radius=50`
    const response = await rest.request("GET", sitesUrl);
    if (!response || !response.Data) {
      logger.info("No stores data");
      return [];
    }
    const storeIds = response.Data.stores.map(s => {
      return {
        storeId: s.storeNumber,
        address: `${s.address}, ${s.city} ${s.zipcode}`
      }
    });
    logger.debug({functionName, storeIds});
    
    return storeIds;
    // // fetch availability
    // const availabilityUrl = "https://www.riteaid.com/services/ext/v2/vaccine/checkSlots?storeNumber=";
    // const requests = [];
    // const validStores = [];
    // for (const store of storeIds) {
    //   const storeUrl = `${availabilityUrl}${store.storeId}`;
    //   const response = await request("GET", storeUrl);
    //   // console.log({functionName, response});
    //   if (response && response.Status === "SUCCESS") {
    //     if (response.Data && response.Data.slots) {
    //       const validSite = Object.values(response.Data.slots).includes(true);
    //       if (validSite) {
    //         validStores.push({store, slots: response.Data.slots})
    //       }
    //     }
    //   }
    // }
    
    // console.log({functionName, validStores: JSON.stringify(validStores)});
    // if (validStores && validStores.length > 0) {
    //   await postValidSites(validStores);
    // }
    // return validStores;
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
    const {riteAid} = pharmacies;
    logger.debug({functionName, subscriptionInfo});
    if (riteAid && riteAid.length > 0) {
      const storeIds = [];
      const storeInserts = [];
      for (store of riteAid) {
        const params = {
          TableName: process.env.tablePharms,
          Item: {
            storeId: `${BRAND.RITEAID_STORE}-${store.storeId}`,
            isAvailable: 0,
            address: store.address,
            createAt: new Date().toISOString()
          },
          ConditionExpression: 'attribute_not_exists(storeId)'
        };
        storeIds.push(store.storeId);
        storeInserts.push(ddb.put(params).promise().catch( error => {
          if (error.code === 'ConditionalCheckFailedException') {
            logger.info({functionName, info: "store has already been added"});
          }
          logger.error({functionName, error: error.toString()});
        }));
      }
      // bookeeping for stores
      const response = await Promise.all(storeInserts);
      logger.debug({functionName, response, info: "added to stores"});
     
      // subscribe the user
      const userInfo = {
        phone,
        riteAid: storeIds
      }
      logger.debug({functionName, userInfo});
      const userResponse = await subscribeUserToStores(userInfo);
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
const subscribeUserToStores = async (userInfo) => {
  const functionName = "subscribeUserToStores";
  const { phone } = userInfo;
  try {
    const updateParams = {
      TableName: process.env.tableContacts,
      Key: {
        phoneMobile: phone,
        isEnabled: 1
      },
      UpdateExpression: "SET updatedAt = :updatedAt, riteAidStores = :riteAidStores",
      ExpressionAttributeValues: {
        ':updatedAt': new Date().toISOString(),
        ':riteAidStores': ddb.createSet(userInfo.riteAid)
      },
      ReturnValues: "ALL_NEW"
    }
    const response = await ddb.update(updateParams).promise();
    logger.debug({functionName, response});
    return response;
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
    return rest.response(200, validStores, thisEndPoint);
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

    let response = await subscribeToNotificationsByPharmacy(subscriptionInfo);
    if (!response) {
      // user already existed
      response = { message: `Subscription already exists`};
    }
    return rest.response(200, response, thisEndPoint);
  } catch (error) {
    logger.error({ thisEndPoint, error: error.toString() });
    return rest.response(500, "Internal Server Error", thisEndPoint);
  }
};

module.exports = {
  getPharmaciesByZipcodeHandler,
  subscribeToNotifications
}
