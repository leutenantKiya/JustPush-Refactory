# Kubernetes Provider Configuration
terraform {
  required_providers {
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.0"
    }
  }
}

provider "kubernetes" {
  config_path    = "./kubeconfig.yaml"
  config_context = "mau-menang"
}