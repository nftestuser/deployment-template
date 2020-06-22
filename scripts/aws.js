const AWS = require('aws-sdk');

const ACCESS_KEY = process.env.AWS_ACCESS_KEY_ID;
const SECRET_KEY = process.env.AWS_SECRET_ACCESS_KEY;
const REGION = 'us-east-2';
const FUNCTIONS_API_GATEWAY = "nfcc-5d494bd4-api-gateway";
const FUNCTIONS_API_KEY = "4yvg781r1b";

function createLambdaClient(region) {
  let cfg = {
    region: region,
    accessKeyId: ACCESS_KEY,
    secretAccessKey: SECRET_KEY,
    apiVersion: '2015-07-09'
  };
  return new AWS.APIGateway(cfg);
}

async function main() {
  let response = {
    data: []
  };
  let client = createLambdaClient(REGION);
  let apiKey = await client.getApiKey({apiKey: FUNCTIONS_API_KEY, includeValue: true}).promise();
  let restApis = await client.getRestApis().promise();
  for (let x = 0; x < restApis.items.length; x++) {
    let rest = restApis.items[x];
    if (rest.name === FUNCTIONS_API_GATEWAY) {
      let params = {
        restApiId: rest.id,
      };
      let resources = await client.getResources(params).promise();
      for (let y = 0; y < resources.items.length; y++) {
        let resource = resources.items[y];
        //console.log("RESOURCE:" + JSON.stringify(resource));
        let endpoint;
        let stages;
        let stage;
        if (resource.resourceMethods) {
          stages = await client.getStages({restApiId: rest.id}).promise();
          stage = `/${stages.item[0].stageName}`;
          endpoint = `https://${rest.id}.execute-api.${REGION}.amazonaws.com${stage}${resource.path}`
          response.data.push(
            {
              functionName: resource.pathPart,
              endpoint: endpoint,
              apiKey: apiKey.value
            }
          );
        }
      }
    }
  }
  console.log(response);
  return response;
}

main();