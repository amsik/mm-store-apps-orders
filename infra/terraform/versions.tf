terraform {
  required_version = ">= 1.9"

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 7.0"
    }
    mongodbatlas = {
      source  = "mongodb/mongodbatlas"
      version = "~> 2.18"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
  }

  # Bootstrapped once by hand (infra/README.md#one-time-bootstrap): the bucket name is
  # project-specific, so it is supplied with `-backend-config`, not hardcoded here.
  backend "gcs" {}
}

provider "google" {
  project = var.gcp_project_id
  region  = var.gcp_region
}

# Auth via the MONGODB_ATLAS_PUBLIC_KEY / MONGODB_ATLAS_PRIVATE_KEY env vars (infra/README.md),
# never as literal provider arguments, so the keys never land in a tfvars file or state.
provider "mongodbatlas" {}
