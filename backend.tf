
terraform {
  backend "s3" {
    bucket = "mm-terraform-state-test"
    key    = "terraform"
    region = "us-east-2"
  }
  

  /*
  backend "azurerm" {
    resource_group_name   = "nfcc-functions"
    storage_account_name  = "cbtfnfccfunctions"
    container_name        = "mm-terraform-state"
    key                   = "terraform.tfstate"
  }
  */
  
}

