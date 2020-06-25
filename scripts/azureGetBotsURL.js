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
  const rawdata = fs.readFileSync('azure_output.json');
  const elements = JSON.parse(rawdata);
  return {
    functionAppName: elements.function_app.value.name,
    resourceGroupName: elements.function_app.value.resource_group_name
  }
}

function getFunctionNamesFromServerlessFile() {
  const yaml = require('js-yaml');
  let functionNames;
  try {
    const fileContents = fs.readFileSync(path.join(process.cwd(), 'serverless.yml'), 'utf8');
    const data = yaml.safeLoad(fileContents);
    functionNames = Object.keys(data.functions);
    return functionNames;
  } catch (e) {
    console.log(e);
  }
}

function getResponse(serverlessFunctionNames, azureFunctions, masterKey) {
  let response = {
    data: []
  };
  let azureFunctionNames = [];
  azureFunctions.forEach(azureFunction => {
    azureFunctionNames.push(azureFunction.properties.name);
  });
  if (serverlessFunctionNames.length > azureFunctionNames.length) {
    serverlessFunctionNames.forEach(serverlessFunctionName => {
      if (azureFunctionNames.includes(serverlessFunctionName)) {
        const azureFunction = azureFunctions.find(azureFunc => azureFunc.properties.name === serverlessFunctionName);
        response.data.push(
          {
            provider: 'azure',
            functionName: serverlessFunctionName,
            endpointUrl: azureFunction.properties.invoke_url_template,
            masterKey: masterKey,
            status: 'OK'
          }
        );
      } else {
        response.data.push(
          {
            provider: 'azure',
            functionName: serverlessFunctionName,
            endpointUrl: "",
            masterKey: masterKey,
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
        response.data.push(
          {
            provider: 'azure',
            functionName: azureFunctionName,
            endpointUrl: azureFunction.properties.invoke_url_template,
            masterKey: masterKey,
            status: 'OK'
          }
        );
      } else {
        const azureFunction = azureFunctions.find(azureFunc => azureFunc.properties.name === azureFunctionName);
        response.data.push(
          {
            provider: 'azure',
            functionName: azureFunctionName,
            endpointUrl: azureFunction.properties.invoke_url_template,
            masterKey: masterKey,
            status: 'failed',
            message: 'Function is still present in azure even if was removed from package.json'
          }
        );
      }
    })
  }
  return response;
}

async function getEndpointsURL() {
  const functionName = parseTerraformOutputFile().functionAppName;
  const resourceGroupName = parseTerraformOutputFile().resourceGroupName;
  let response = {
    data: []
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
      let timeout = 120000;//2 min
      while (timeout > 0) {
        if (azureFunctions.length !== serverlessFunctionNames.length) {
          timeout -= 5000;
          if (timeout === 0) {
            response = getResponse(serverlessFunctionNames, azureFunctions, keys.masterKey);
            console.log(response);
            return response;
          }
          console.log("Sleep 5 seconds");
          await sleepUtils.sleep(5000);
          azureFunctions = await azFunctions.listFunctions();
        } else {
          break;
        }
      }
      let functionName;
      for (let y = 0; y < azureFunctions.length; y++) {
        functionName = azureFunctions[y].properties.name;
        let endpointUrl = azureFunctions[y].properties.invoke_url_template;
        response.data.push(
          {
            provider: 'azure',
            functionName: functionName,
            endpointUrl: endpointUrl,
            masterKey: keys.masterKey,
            status: 'OK'
          }
        );
      }

    }
  }
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
