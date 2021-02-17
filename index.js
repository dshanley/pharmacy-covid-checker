const requestApi = require('request-promise');

const ZIP_CODE = "48105";
const ZAPIER_HOOK = "https://hooks.zapier.com/hooks/catch/account_id/hook_id";

// ///////////////////////////////////////////////////////////////////////////////////////////////////
// Utils

const request = async (method, url, data, headers, json=true) => {
  console.log(`Making request ${url}`);
  const accepted = ['GET', 'POST', 'PUT', 'DELETE'];
  if (accepted.indexOf(method) < 0) throw new Error('Your request method is not an accepted request method');
  // if (json === null) json = true; // eslint-disable-line no-param-reassign

  const options = {
    uri: url,
    json,
    method,
    resolveWithFullResponse: true,
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
      console.warning(`Warning: Response Status: ${statusCode}`);
    }
    return body;
  } catch (error) {
    console.error(error);
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
const response = (status, data, endpointName) => {
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


// ///////////////////////////////////////////////////////////////////////////////////////////////////
// Check Sites

const postValidSites = async (validStores) => {
  const functionName = "postValidSites";
  try {
    const stores = validStores.map(s => `[${s.store.storeId}] ${s.store.address}`);
    const message = stores.join(', ');
    const headers = {
      "Accept": "application/json",
      "Content-Type": "application/json"
    }
    const response = await request("POST", ZAPIER_HOOK, {message}, headers);
    console.log({functionName, response});
  } catch (error) {
    console.error(error);
    throw new Error(error);
  }
}

const getValidVaccineSites = async () => {
  const functionName = "getValidVaccineSites";

  try {
    // get the sites near a zipcode
    const sitesUrl = "https://www.riteaid.com/services/ext/v2/stores/getStores?address=ann%20arbor,%20mi&attrFilter=PREF-112&fetchMechanismVersion=2&radius=60"
    const response = await request("GET", sitesUrl);
    if (!response || !response.Data) {
      console.log("No stores data");
      return false;
    }
    const storeIds = response.Data.stores.map(s => {
      return {
        storeId: s.storeNumber,
        address: `${s.address} ${s.city} ${s.zipcode}`
      }
    });
    console.log({functionName, storeIds});
    // fetch availability
    const availabilityUrl = "https://www.riteaid.com/services/ext/v2/vaccine/checkSlots?storeNumber=";
    const requests = [];
    const validStores = [];
    for (const store of storeIds) {
      const storeUrl = `${availabilityUrl}${store.storeId}`;
      const response = await request("GET", storeUrl);
      // console.log({functionName, response});
      if (response && response.Status === "SUCCESS") {
        if (response.Data && response.Data.slots) {
          const validSite = Object.values(response.Data.slots).includes(true);
          if (validSite) {
            validStores.push({store, slots: response.Data.slots})
          }
        }
      }
    }
    
    console.log({functionName, validStores: JSON.stringify(validStores)});
    if (validStores && validStores.length > 0) {
      await postValidSites(validStores);
    }
    return validStores;
  } catch (error) {
    console.log({functionName, error: error.toString()});
    return false;
  }
}

// ///////////////////////////////////////////////////////////////////////////////////////////////////
// Handler

exports.handler = async (event) => {
    
    let validStores = [];
    try {
        validStores = await getValidVaccineSites();
    } catch (e) {
        console.error(e);
    }
    
    const response = {
        statusCode: 200,
        body: JSON.stringify(`Ran RiteAid check - valid ${validStores.length}`),
    };
    return response;
};
