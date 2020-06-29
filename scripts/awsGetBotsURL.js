const path = require('path');
const axios = require('axios');

const AZURE_FUNCTION_URL = "http://08de43543805839a.azurewebsites.net/api/pocIntegrationHandler?code=uPPVaN0FYW7yN8cV56GqMt2PRhYzXypnYWbuqFOWrttt/v0VrskqTg==";


function parseJsonFile(filePath) {
  const fs = require('fs');
  const data = fs.readFileSync(filePath);
  return JSON.parse(data);
}


function getEndpointsURL() {
  let response = {
    mode: "Post_Bot_Deployment",
    customer: "",
    functions: []
  };

  const outputJsonData = parseJsonFile(path.join(process.cwd(), 'output.json'));
  const packageJsonData = parseJsonFile(path.join(process.cwd(), 'package.json'));
  const customerName = packageJsonData["customerConfig"].customerName;
  const incrementNumber = packageJsonData["customerConfig"].incrementNumber;
  const apiKeyValue = outputJsonData["api_key"].value.value;
  const invokeUrl = outputJsonData["aws_api_gateway_deployment"].value.invoke_url;
  for (let element in outputJsonData) {
    if (element !== "api_key" && element !== "aws_api_gateway_deployment") {
      for (let dependency in packageJsonData["dependencies"]) {
        if (dependency.includes(element)) {
          response.functions.push(
            {
              functionName: element,
              version: packageJsonData["dependencies"][dependency],
              endpointUrl: invokeUrl + outputJsonData[element].value.path,
              key: apiKeyValue,
              status: "success"
            }
          );
        }
      }
    }
  }
  response.customer = customerName + "-" + incrementNumber;
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
  })
    .catch(function (error) {
      console.error(error);
    })
}

callAzureFunction();
