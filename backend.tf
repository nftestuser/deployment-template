
terraform {

  backend "s3" {
    bucket = "nftestuser-tfstate-bucket"
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

