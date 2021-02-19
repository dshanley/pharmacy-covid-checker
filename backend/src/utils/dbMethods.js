/* eslint-disable no-use-before-define */
/* eslint-disable no-restricted-syntax */
/* eslint-disable no-param-reassign */
const AWS = require('aws-sdk');
const to = require('await-to-js').default;
const dynamodb = require('./dynamodb');
const logger = require('./cc-logger').startLogging('dbmethod-helper');

// /////////////////////////////////////////////////
// New

/**
 *
 * @param {object} data
 * @param {object} tableName
 * @param {object} endpoint
 * @returns {object} response
 */
const createNew = async (data, tableName, endpoint) => {
	const functionName = "dbMethods:createNew";
	if (data.createdAt === undefined || data.createdAt === null) data.createdAt = new Date().toISOString();
	if (data.updatedAt === undefined || data.updatedAt === null) data.updatedAt = new Date().toISOString();

	return new Promise((resolve, reject) => {
		const dbParams = {
			TableName: tableName,
			Item: data,
		};

		logger.debug({ functionName, dbParams, endpoint, info: "attempting to save" });
		
		dynamodb.put(dbParams, (error) => {
			if (error) {
				logger.error({ functionName, dbParams, endpoint, error });
				reject(error);
			}
			
			const item = dbParams.Item;
			logger.debug({ functionName, item, endpoint, info: "saved" });
			resolve(item);
		});
	});
};


// /////////////////////////////////////////////////
// Fetch

/**
 *
 * @param {object} dbParams
 * @param {object} endpoint
 * @returns {object} response
 */
const getByParams = async (dbParams) => {
	const functionName = "getByParams";

	const [error, result] = await to(dynamodb.get(dbParams).promise());
	if (error) {
		logger.error({functionName, dbParams, error: error.toString()});
		throw new Error(error);	
	}
	if (result && result.Item) {
		return result.Item;
	}
	return result;
};

/**
 * Query DDB by the params given. Paginates over the results to return the full set of results.
 * @param {Object} dbParams 
 * @param {Array} results optional and used for recursion
 */
const queryByParams = async (dbParams, allResults = []) => {
  const functionName = "queryByParams";
  logger.debug({functionName, dbParams, resultsCount: allResults.length});

	if (!dbParams) {
		logger.error({functionName, error: "dbParams is required"});
		throw new Error("Params are required when calling queryByParams");
	}

  try {
    const [error, results] = await to(dynamodb.query(dbParams).promise());
    if (error) {
      logger.error({functionName, dbParams, error: error.toString()});
      throw new Error(error);
    }
    logger.debug({functionName, dbParams, resultsSize: results.length});
    if (results && results.Items.length > 0) {
      allResults = [...allResults, ...results.Items];

      // we have to paginate
      if (results.LastEvaluatedKey) {
        logger.debug({functionName, dbParams, lastEvaluatedKey: results.LastEvaluatedKey, info: "paginating results"});
        dbParams.ExclusiveStartKey = results.LastEvaluatedKey;
        return await queryByParams(dbParams, allResults);
      } 
      
      return allResults;
    }
    return false;
  } catch (error) {
    logger.error({functionName, dbParams, error: error.toString()});
    throw new Error(error);
  }
}





// /////////////////////////////////////////////////
// Delete & Archive

/**
 * Delete the supplied object if found
 * This operation is a hard delete and cannot be undone
 * @param {String} tableName 
 * @param {Object} deleteParams delete params of the form:
 * { Key: {
 *    "keyName": "keyValue" 
 * }}
 * @param {String} endpoint 
 * @returns the delete promise
 */
const deleteItem = async (tableName, deleteParams, endpoint) => {
	const functionName = "deleteItem";

	let params = {
		TableName: tableName,
	};
	params = { ...params, ...deleteParams };
	logger.debug(`${endpoint}:${functionName} attempting to delete: ${JSON.stringify(params)}`);
	try {
		return dynamodb.delete(params).promise();
	} catch (error) {
		throw new Error(error);
	}
};

/**
 * Query using params and use the resulting objects to batch delete.
 * DDB doesn't allow deleting by index keys, so you have to delete using primary keys, so
 * we use this pattern
 * @param {String} tableName 
 * @param {Object} params ddb doc client params
 */
const deleteBatch = async (tableName, params, endpoint) => {
	const functionName = "deleteBatch";
	logger.debug({functionName, tableName, params, endpoint});

	try {
		const queryParams = {
			TableName: tableName,
			...params
		}
		const deleteParams = {
			ReturnConsumedCapacity: 'TOTAL',
		};
		logger.debug({functionName, queryParams});
		const items = await ddbutil.query(dynamodb, queryParams);
		logger.debug({functionName, items, info: "delete: items query"});
		if (items && items.length) {
			const response = await ddbutil.batchDelete(dynamodb, deleteParams, tableName, items);
			return response;
		}
		return false;
	} catch (error) {
		logger.error({functionName, endpoint, error: error.toString()});
		throw new Error(error);
	}
}

// /////////////////////////////////////////////////
// DDB Sets

/**
 * Convert the DDB JSON format (which includes field types) to JSON
 * This is used in Stream processing.
 * @param {Object} ddbJson DDB JSON format
 */
const convertDdbToJson = (ddbJson) => {
	if (!ddbJson) return ddbJson;

	return AWS.DynamoDB.Converter.unmarshall(ddbJson);
};

/**
 * Convert JSON to DDBJSON format (which includes field types)
 * This is used in metrics batch update
 * @param {Object} json JSON format
 */
const convertJsonToDdb = (json) => {
	if (!json) return json;

	return AWS.DynamoDB.Converter.marshall(json);
};

// /////////////////////////////////////////////////
// Update 

/**
 * Flatten the object but using lookup in keyMap for substitution
 * @param {Object} obj the object to flatted
 * @param {String} prefix prefix for flattening
 * @see https://bit.ly/2neWfJ2 
 */
const flattenObject = (obj, prefix = '', keyMap) => {
	logger.debug({obj, prefix, keyMap});
  return Object.keys(obj).reduce((acc, k) => {
    const pre = prefix.length ? `${prefix}.#` : '';
    if (typeof obj[k] === 'object') {
      Object.assign(acc, flattenObject(obj[k], `${pre}${keyMap[k]}`, keyMap));
    }
    else {
      acc[`#${pre}${keyMap[k]}`] = obj[k];
    }
    return acc;
  }, {});
}

const allKeys = (obj, keySet = new Set([])) => {
  for (const key of Object.keys(obj)) {
    if (typeof obj[key] === 'object') {
      allKeys(obj[key], keySet);
    } 
    keySet.add(key);
  }
  return [...keySet];
}

/**
 * A simple approach to building the Update params with ExpressionAttributeNames and ExpressionsAtributeValues with the nested keys and values from an object.
 * Note: If you try to update a deeply nested structure that doesn't exist, you may likely get an error in your corresponding method if you don't handle that.
 * Note: we convert key names to params0...N so we don't run into illegal syntax with ddb for keys (like _, -, #)
 * @returns the set of params including the UpdateExpression
 * @param {Object} json The object to extract the keys and values from
 */
const buildUpdateStatementFromObject = (json) => {
	const functionName = "updateStatementFromObject";
	logger.debug({functionName, json});

	if (!json) {
		return json;
	}

	const attributes = {
		ExpressionAttributeNames: {},
		ExpressionAttributeValues: {}
	}

	let updateExpression = "SET";

	// process all keys
	const keySet = allKeys(json);
	const keyMap = {};
	for (const key of keySet) {
		const paramName = `param${keySet.findIndex(e => e === key)}`;
		attributes.ExpressionAttributeNames[`#${paramName}`] = key;
		keyMap[key] = paramName;
	}
	// process all values and update expression
	const flatJson = flattenObject(json, '', keyMap);
	let counter = 0;
	for (const [key, value] of Object.entries(flatJson)) {
		// add to value index
		attributes.ExpressionAttributeValues[`:value${counter}`] = value;	
		// build statement
		const expression = `${key} = :value${counter}`;
		updateExpression = updateExpression === "SET" ? `${updateExpression} ${expression}` : `${updateExpression}, ${expression}`;

		counter += 1;
	}
	attributes.UpdateExpression = updateExpression;

	logger.debug({functionName, attributes});
	return attributes;
};


module.exports = {
	getByParams,
	queryByParams,
	createNew,
	deleteItem,
	convertDdbToJson,
	convertJsonToDdb,
	buildUpdateStatementFromObject,
	deleteBatch
};
