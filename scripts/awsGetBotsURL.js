function parseJsonFile() {
  let response = {
    data: []
  };

  const fs = require('fs');

  const rawdata = fs.readFileSync('output.json');
  const elements = JSON.parse(rawdata);
  const apiKeyValue = elements["api_key"].value.value;
  const invokeUrl = elements["aws_api_gateway_deployment"].value.invoke_url;
  for (let element in elements) {
    if (element !== "api_key" && element !== "aws_api_gateway_deployment") {
      response.data.push(
        {
          provider:"aws",
          functionName: element,
          endpointUrl: invokeUrl + elements[element].value.path,
          key: apiKeyValue
        }
      );
    }
  }

  console.log(response);
  return response;
}

parseJsonFile();
