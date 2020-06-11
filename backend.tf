terraform {
  backend "s3" {
    bucket = "mm-terraform-state-test"
    key    = "terraform"
    region = "us-east-2"
  }
  

  /*
  backend "azurerm" {
    resource_group_name   = "RESOURCE GROUP NAME"
    storage_account_name  = "STORAGE ACCOUNT NAME"
    container_name        = "CONTAINER NAME"
    key                   = "terraform.tfstate"
  }
  */
}

