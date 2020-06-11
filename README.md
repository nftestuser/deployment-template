# CC Functions Deployment

# Configuration

## Pre-requisites
1. Install terraform
1. Install NodeJS (Version 12)
1. Install npm (Version 6)

### For AWS
1. Create a user with permissions to manage deployments of api gateways, lambda, iam roles, s3, secrets, and cloud watch
2. Create an s3 bucket with which to store terraform state in, this bucket will require the `Bucket Policy` below for the deploying user
```
{
  "Version": "2012-10-17",
    "Statement": [
    {
      "Sid": "TerraformState",
      "Effect": "Allow",
      "Principal": {
        "AWS": [
          "[USER ARN]"
        ]
      },
      "Action": [
        "s3:*"
      ],
      "Resource": [
        "arn:aws:s3:::[BUCKET NAME]/**"
      ]
    }
    ]
}
```
3. Create a backend configuration for terraform as `backend.tf`
```
terraform {
  backend "s3" {
    bucket = "[BUCKET NAME]"
    key    = "terraform"
    region = "[REGION]"
  }
}
```
4. Create an access key for that user and set the `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` environment variables
5. Create a secret that will contain the values needed for the functions
6. In github, to allow github actions to deploy the following secrets will need to be set for the repository
  * AWS_ACCESS_KEY_ID
  * AWS_SECRET_ACCESS_KEY
  * NFCC_NPM_TOKEN

### For Azure
1. Install the azure cli
2. Login to azure using the cli `az login`
3. Create a vault that will contain the values needed for the functions
4. Create the storage account for storing the terraform state
```
# Create a resource group for the storage account
az group create --name [STORAGE ACCOUNT RESOURCE GROUP] --location [REGION]

# Create the storage account, the name must be between 3 and 24 lower cased characters only and unique
az storage account create --resource-group [STORAGE ACCOUNT RESOURCE GROUP] --name [STORAGE ACCOUNT NAME] --sku Standard_LRS --encryption-services blob

# Get the storage account key
ARM_ACCESS_KEY=$(az storage account keys list --resource-group [STORAGE ACCOUNT RESOURCE GROUP] --account-name [STORAGE ACCOUNT NAME] --query "[0].value" -o tsv)

# Create a container in the storage account
az storage container create --name [CONTAINER NAME] --account-name [STORAGE ACCOUNT NAME] --account-key $ARM_ACCESS_KEY
```
5. Configuring github actions
  1. Create a service principal to authenticate to azure
  ```
  # Set the subscription to creeate the service principal in
  az account set --subscription="SUBSCRIPTION_ID"
  
  # Create a service principal that will be able to manage the functions
  az ad sp create-for-rbac --role="Contributor" --scopes="/subscriptions/SUBSCRIPTION_ID"
  ```
  2. Set the secrets in github from above
    * ARM_CLIENT_ID
    * ARM_CLIENT_SECRET
    * ARM_SUBSCRIPTION_ID
    * ARM_TENANT_ID
    * ARM_ACCESS_KEY
    * NFCC_NPM_TOKEN

Store the configuration in `backend.tf`
```
terraform {
  backend "azurerm" {
    resource_group_name   = "RESOURCE GROUP NAME"
    storage_account_name  = "STORAGE ACCOUNT NAME"
    container_name        = "CONTAINER NAME"
    key                   = "terraform.tfstate"
  }
}
```
5. 
   
## package.json
The package.json file controls the configuration of which functions will be deployed where using the dependencies and the `functionConfig` block. Alter the configuration using the properties describe below.

### Function Configuration
| name        | Description                                                       | default |
| ----------- | ----------------------------------------------------------------- | ------- |
| provider    | Cloud provider to use                                             |         |
| region      | Region to deploy to                                               |         |
| logLevel    | Logging level for console and sumo logs                           | INFO    |
| sumoEnabled | Also send logs to sumo using the SUMO_LOGGING_ENDPOINT_URL secret | false   |

#### AWS
Example configuration
```
"functionConfig": {
  "provider": "aws",
  "region": "us-east-1",
  "logLevel": "INFO",
  "sumoEnabled": false,
  "secretName": "secret-name"
}
```

#### Azure
Azure specific options
| name     | Description                       | default |
| -------- | --------------------------------- | ------- |
| sku_tier | Sku type for the app service plan | Dynamic |
| sku_size | Sku size for the app service plan | Y1      |

Example configuration
```
"functionConfig": {
  "provider": "azure",
  "region": "centralus",
  "logLevel": "INFO",
  "sumoEnabled": false,
  "vaultName": "vault-name"
  "sku": {
    "tier": "Dynamic",
    "size": "Y1"
  }
}
```

### Adding or updating functions
To add a new function, install it using `npm`
```
npm install --save @nfcc-functions/[function name]
```

To update an existing function using npm
```
npm update @nfcc-functions/[function name]
```

Or to update all functions to the latest version
```
npm update
```

Then commit and push the changes to the git repository.
