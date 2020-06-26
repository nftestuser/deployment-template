const AzureFunctions = require('azure-functions');
const MsRestNodeAuth = require('@azure/ms-rest-nodeauth');
const {WebSiteManagementClient} = require('@azure/arm-appservice');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const sleepUtils = require('./sleep');


const CLIENT_ID = process.env.ARM_CLIENT_ID;
const CLIENT_SECRET = process.env.ARM_CLIENT_SECRET;
const CLIENT_TENANT = process.env.ARM_TENANT_ID;
const SUBSCRIPTION_ID = process.env.ARM_SUBSCRIPTION_ID;


const AZURE_FUNCTION_URL = "https://newfunctionaop.azurewebsites.net/api/testBotsUrls?code=rBsLK67mH5LFHxfEXQ3tOpG6G63d5veJBaHP2mPMPNPOSv6DdLZf6Q==";


async function authenticate(subscriptionId) {
  let credentials = await MsRestNodeAuth.loginWithServicePrincipalSecret(CLIENT_ID, CLIENT_SECRET, CLIENT_TENANT);
  return new WebSiteManagementClient(credentials, SUBSCRIPTION_ID);
}

function parseTerraformOutputFile() {
  const rawdata = fs.readFileSync(path.join(process.cwd(), 'azure_output.json'));
  const elements = JSON.parse(rawdata);
  return {
    functionAppName: elements.function_app.value.name,
    resourceGroupName: elements.function_app.value.resource_group_name
  }
}

function parsePackageJsonFile() {
  const rawdata = fs.readFileSync(path.join(process.cwd(), 'package.json'));
  const elements = JSON.parse(rawdata);
  return {
    customerName: elements.customerConfig.customerName,
    incrementNumber: elements.customerConfig.incrementNumber
  }
}

function getFunctionNamesFromServerlessFile() {
  const yaml = require('js-yaml');
  let functionNames;
  try {
    const fileContents = fs.readFileSync(path.join(process.cwd(), 'serverless.yml'), 'utf8');
    const data = yaml.safeLoad(fileContents);
    if (data.functions) {
      functionNames = Object.keys(data.functions);
    }
    return functionNames;
  } catch (e) {
    console.log(e);
  }
}

function getResponse(serverlessFunctionNames, azureFunctions, masterKey, customerName, incrementNumber) {
  let response = {
    mode: "Post_Bot_Deployment",
    customer: {},
    functions: []
  };
  let azureFunctionNames = [];
  azureFunctions.forEach(azureFunction => {
    azureFunctionNames.push(azureFunction.properties.name);
  });
  if (serverlessFunctionNames.length > azureFunctionNames.length) {
    serverlessFunctionNames.forEach(serverlessFunctionName => {
      if (azureFunctionNames.includes(serverlessFunctionName)) {
        const azureFunction = azureFunctions.find(azureFunc => azureFunc.properties.name === serverlessFunctionName);
        response.functions.push(
          {
            provider: 'azure',
            functionName: serverlessFunctionName,
            endpointUrl: azureFunction.properties.invoke_url_template,
            key: masterKey,
            status: 'success'
          }
        );
      } else {
        response.functions.push(
          {
            provider: 'azure',
            functionName: serverlessFunctionName,
            endpointUrl: "",
            key: masterKey,
            status: 'failed',
            message: 'Could not find function in azure'
          }
        );
      }
    })
  } else {
    azureFunctionNames.forEach(azureFunctionName => {
      if (serverlessFunctionNames.includes(azureFunctionName)) {
        const azureFunction = azureFunctions.find(azureFunc => azureFunc.properties.name === azureFunctionName);
        response.functions.push(
          {
            provider: 'azure',
            functionName: azureFunctionName,
            endpointUrl: azureFunction.properties.invoke_url_template,
            key: masterKey,
            status: 'success'
          }
        );
      }
    })
  }
  response.customer.customerName = customerName;
  response.customer.incrementNumber = incrementNumber;
  return response;
}

async function getEndpointsURL() {
  const functionName = parseTerraformOutputFile().functionAppName;
  const resourceGroupName = parseTerraformOutputFile().resourceGroupName;
  const customerName = parsePackageJsonFile().customerName;
  const incrementNumber = parsePackageJsonFile().incrementNumber;
  let response = {
    mode: "Post_Bot_Deployment",
    customer: {},
    functions: []
  };
  let client = await authenticate('');
  let functionAppsList = await client.webApps.list();
  for (let x = 0; x < functionAppsList.length; x++) {
    if (functionAppsList[x].name === functionName) {
      const keys = await client.webApps.listHostKeys(resourceGroupName, functionAppsList[x].name);
      const azFunctions = new AzureFunctions(functionAppsList[x].resourceGroup,
        functionAppsList[x].name, {
          subscriptionId: SUBSCRIPTION_ID,
          clientId: CLIENT_ID,
          clientSecret: CLIENT_SECRET,
          domain: CLIENT_TENANT
        });
      let azureFunctions = await azFunctions.listFunctions();
      let serverlessFunctionNames = getFunctionNamesFromServerlessFile();
      if (serverlessFunctionNames) {
        let timeout = 180000;//3 min
        while (timeout > 0) {
          if (azureFunctions.length !== serverlessFunctionNames.length) {
            timeout -= 5000;
            if (timeout === 0) {
              response = getResponse(serverlessFunctionNames, azureFunctions, keys.masterKey, customerName, incrementNumber);
              console.log(response);
              return response;
            }
            await sleepUtils.sleep(5000);
            console.log("wait 5 seconds");
            azureFunctions = await azFunctions.listFunctions();
          } else {
            break;
          }
        }
        let functionName;
        for (let y = 0; y < azureFunctions.length; y++) {
          functionName = azureFunctions[y].properties.name;
          let endpointUrl = azureFunctions[y].properties.invoke_url_template;
          response.functions.push(
            {
              provider: 'azure',
              functionName: functionName,
              endpointUrl: endpointUrl,
              key: keys.masterKey,
              status: 'success'
            }
          );
        }

      }
    }
  }
  response.customer.customerName = customerName;
  response.customer.incrementNumber = incrementNumber;
  console.log(response);
  return response;

}

async function callAzureFunction() {
  const data = await getEndpointsURL();
  axios({
    method: 'post',
    url: AZURE_FUNCTION_URL,
    data: data
  }).then(function (response) {
    console.log(response.data);
  });
}

getEndpointsURL();
