const requestApi = require('request-promise');
const ddb = require('./utils/dynamodb');
const dbUtils = require('./utils/dbMethods');
const rest = require('./utils/rest');
const constants = require('./constants');
const logger = require('./utils/cc-logger').startLogging('jobs');



const pollForVaccineSlots = async () => {
  const functionName = "pollForVaccineSlots";

  try {
    // get all the stores
    const stores = await dbUtils.getAllRecords({ TableName: process.env.tablePharms });
    if (!stores || stores.length === 0) {
      return [];
    }

    // check riteaid stores
    const storeChecks = stores.map( store => {
      const storeUrl = `${constants.RITE_AID_CHECK_URL}${store.storeId}`
      return rest.request("GET", storeUrl).then( result => {
        if (result && result.Status === "SUCCESS") {
          if (result.Data && result.Data.slots) {
            const validSite = Object.values(result.Data.slots).includes(true);
            if (validSite) {
              return {
                storeId: store.storeId, 
                slots: result.Data.slots,
                storeKey: `${constants.BRAND.RITEAID_STORE}-${store.storeId}`};
            }
          }
        }
        return {};
      }).catch ( error => {
        logger.error({functionName, error: error.toString()});
      });
    });
    const storeCheckResults = await Promise.all(storeChecks);
    logger.debug({functionName, stores, storeCheckResults});

    // update state
    const storesNowAvailable = await updatePharmState(allStores, storeCheckResults);
    
  } catch (error) {
    logger.error({functionName, error: error.toString()});
    throw new Error(error);
  }
}

/**
 * Update the pharmacy status
 * -> for the stores that are no longer available
 * -> for stores that have become available
 * Taking care to look at the return results of the update, so we don't keep notifying
 * on sites that are already available
 * @param {Object} allStores 
 * @param {Object} storeCheckResults 
 * @returns Array of stores that were update to active
 */
const updatePharmState = async (allStores, storeCheckResults) => {
  const functionName = "updatePharmState";

  try {
    // filter all existing stores that did have vaccine 
    // id is storeKey
    const storesWithVaccine = allStores.filter( store => store.isAvailable === 1);
    logger.debug({functionName, storesWithVaccine});

    // turn off if not in result set
    const storesWithUpdatedNegativeState = storesWithVaccine.filter( ({id: storeKey1}) => !storeCheckResults.some( ({storeKey: storeKey2}) => storeKey2 === storeKey1));
    logger.debug({functionName, storesWithUpdatedNegativeState});

    // batch update stores no longer available
    let batchUpdates = [];
    const updatedDate = new Date().toISOString();
    for (const store of storesWithUpdatedNegativeState) {
      const updateParams = {
        TableName: process.env.tablePharms,
        Key: { "id": store.id },
        UpdateExpression: 'SET isAvailable = :isAvailable, updatedAt = :updatedAt',
        ExpressionAttributeValues: {
          ':isAvailable': 0,
          ':updatedAt': updatedDate
        },
        ReturnValues: "NONE"
      };
      batchUpdates.push(ddb.update(updateParams).promise().catch( error => {
        logger.error({functionName, store, error: error.toString()});
      }))
    }
    await Promise.all(batchUpdates);

    // filter stores that have vaccine from latest check
    const storesWithUpdatedPositiveState = storeCheckResults.filter( ({slots}) => {
      if (!slots) {
        return false;
      }
      return Object.values(slots).includes(true);
    })
    logger.debug({functionName, storesWithUpdatedPositiveState});

    // batch update with stores that are available
    // note key is slightly different in the incoming structure
    batchUpdates = [];
    for (const store of storesWithUpdatedPositiveState) {
      const updateParams = {
        TableName: process.env.tablePharms,
        Key: { "id": store.storeKey },
        UpdateExpression: 'SET isAvailable = :isAvailable, updatedAt = :updatedAt',
        ConditionExpression: 'isAvailable <> :isAvailable',
        ExpressionAttributeValues: {
          ':isAvailable': 1,
          ':updatedAt': updatedDate
        },
        ReturnValues: "ALL_NEW"
      };
      batchUpdates.push(ddb.update(updateParams).promise().then(result => {
        // clean up response so it's not wrapped in "Attributes:"
        if (result && result.Attributes) {
          return result.Attributes;
        }
      }).catch( error => {
        if (error.code === 'ConditionalCheckFailedException') {
          // we just won't do the update, it's fine
          return;
        }
        logger.error({functionName, store, error: error.toString()});
      }))
    }
    const updatedStores = await Promise.all(batchUpdates);
    logger.debug({functionName, updatedStores, info: "only updated stores"});
    return updatedStores;

  } catch (error) {
    logger.error({functionName, error: error.toString()});
    throw new Error(error);
  }
}

// ///////////////////////////////////////////////////////////////////////////////////////////////////
// Handlers

/**
 * Get the pharmacies given a zipcode
 * @param {Object} event 
 */
const checkForVaccineSlots = async (event) => {
  const thisEndPoint = "SCHEDULED checkForVaccineSlots";
  
  try {
    
    validStores = await pollForVaccineSlots();
    const response = {
      pharmacies: {
        ...validStores
      }
    };
    return rest.response(200, response, thisEndPoint);
  } catch (error) {
    logger.error({ thisEndPoint, error: error.toString() });
    return rest.response(500, "Internal Server Error", thisEndPoint);
  }
};

module.exports = {
  checkForVaccineSlots
}