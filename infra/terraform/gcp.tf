data "google_project" "this" {
  project_id = var.gcp_project_id
}

locals {
  gcp_services = [
    "run.googleapis.com",
    "artifactregistry.googleapis.com",
    "secretmanager.googleapis.com",
    "iam.googleapis.com",
    "iamcredentials.googleapis.com",
    "cloudresourcemanager.googleapis.com",
    "sts.googleapis.com",
  ]
}

resource "google_project_service" "this" {
  for_each = toset(local.gcp_services)

  project = var.gcp_project_id
  service = each.value

  # A demo project: disabling APIs on destroy would also tear down anything else in the
  # project that happens to depend on them.
  disable_on_destroy = false
}

resource "google_artifact_registry_repository" "images" {
  project       = var.gcp_project_id
  location      = var.gcp_region
  repository_id = "orders"
  format        = "DOCKER"
  description   = "Container images for orders-api and orders-web."

  depends_on = [google_project_service.this]
}
