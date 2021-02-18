const requestApi = require('request-promise');
const logger = require('./utils/cc-logger').startLogging('pharms');
const rest = require('./utils/rest');

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
        address: `${s.address} ${s.city} ${s.zipcode}`
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
  } catch (e) {
    logger.error({ thisEndPoint, zipcode });
    return rest.response(500, "Internal Server Error", thisEndPoint);
  }
};

module.exports = {
  getPharmaciesByZipcodeHandler,
}
