const requestApi = require('request-promise');
const ddb = require('./utils/dynamodb');
const dbUtils = require('./utils/dbMethods');
const rest = require('./utils/rest');
const logger = require('./utils/cc-logger').startLogging('pharms');

const RITE_AID_CHECK_URL = "https://www.riteaid.com/services/ext/v2/vaccine/checkSlots?storeNumber=";

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
      const storeUrl = `${RITE_AID_CHECK_URL}${store.storeId}`
      return rest.request("GET", storeUrl).then( result => {
        if (result && result.Status === "SUCCESS") {
          if (result.Data && result.Data.slots) {
            const validSite = Object.values(result.Data.slots).includes(true);
            if (validSite) {
              return {storeId: store.storeId, slots: result.Data.slots};
            }
          }
        }
        return {};
      }).catch ( error => {
        logger.error({functionName, error: error.toString()});
      });
    });
    const storeCheckResults = await Promise.all(storeChecks);
    logger.debug({functionName, storeCheckResults});
    // const allStoreIds = stores.map(s => s.storeId);
    // const validStoreIds = validStores.map
  } catch (error) {
    logger.error({functionName, error: error.toString()});
    throw new Error(error);
  }
}

const updatePharmState = async (allStores, storeCheckResults) => {
  const functionName = "updatePharmState";

  try {
    // filter all existing stores that did have vaccine 

    // turn off if not in result set

    // filter stores that have vaccine from latest check

    // toggle status to on if not already in existing stores

    
  } catch (error) {
    logger.error({functionName, error: error.toString()});
    throw new Error(error);
  }
}

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


// ///////////////////////////////////////////////////////////////////////////////////////////////////
// Handlers

/**
 * Get the pharmacies given a zipcode
 * @param {Object} event 
 */
const checkForVaccineSlots = async (event) => {
  const thisEndPoint = "SCHEDULED checkForVaccineSlots";
  
  try {
    
    validStores = await pollForVacclineSlots();
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

module.exports = {
  pollForVaccineSlots
}