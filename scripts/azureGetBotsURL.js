const AzureFunctions = require('azure-functions');
const MsRestNodeAuth = require('@azure/ms-rest-nodeauth');
const {WebSiteManagementClient} = require('@azure/arm-appservice');

const CLIENT_ID = process.env.ARM_CLIENT_ID;
const CLIENT_SECRET = process.env.ARM_CLIENT_SECRET;
const CLIENT_TENANT = process.env.ARM_TENANT_ID;
const SUBSCRIPTION_ID = process.env.ARM_SUBSCRIPTION_ID;


async function authenticate() {
  let credentials = await MsRestNodeAuth.loginWithServicePrincipalSecret(CLIENT_ID, CLIENT_SECRET, CLIENT_TENANT);
  return new WebSiteManagementClient(credentials, SUBSCRIPTION_ID);
}

function parseJsonFile() {
  const fs = require('fs');
  const rawdata = fs.readFileSync('azure_output.json');
  const elements = JSON.parse(rawdata);
  return {
    functionAppName: elements.function_app.value.name,
    resourceGroupName: elements.function_app.value.resource_group_name
  }
}


async function getEndpointsURL() {
  const functionName = parseJsonFile().functionAppName;
  const resourceGroupName = parseJsonFile().resourceGroupName;
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
      let functions = await azFunctions.listFunctions();
      let endpointUrl;
      let functionName;
      for (let y = 0; y < functions.length; y++) {
        functionName = functions[y].properties.name;
        endpointUrl = functions[y].properties.invoke_url_template;
        response.data.push(
        {
          functionName: functionName,
          endpointUrl: endpointUrl,
          masterKey: keys.masterKey
        }
      );
      }
    }
  }
  console.log(response);
}

getEndpointsURL();
