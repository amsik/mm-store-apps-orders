# Two identities, least privilege each: `runtime` is what Cloud Run assumes to serve requests
# (reads one secret, nothing else); `deploy` is what GitHub Actions assumes to ship a release
# (pushes images, updates the two Cloud Run services, nothing else). Never the same identity.

resource "google_service_account" "runtime" {
  project      = var.gcp_project_id
  account_id   = "orders-runtime"
  display_name = "Cloud Run runtime identity for orders-api"
}

resource "google_service_account" "deploy" {
  project      = var.gcp_project_id
  account_id   = "orders-deploy"
  display_name = "GitHub Actions deploy identity"
}

resource "google_secret_manager_secret_iam_member" "runtime_reads_database_url" {
  project   = var.gcp_project_id
  secret_id = google_secret_manager_secret.database_url.secret_id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.runtime.email}"
}

resource "google_project_iam_member" "deploy_pushes_images" {
  project = var.gcp_project_id
  role    = "roles/artifactregistry.writer"
  member  = "serviceAccount:${google_service_account.deploy.email}"
}

resource "google_cloud_run_v2_service_iam_member" "deploy_manages_api" {
  project  = var.gcp_project_id
  location = var.gcp_region
  name     = google_cloud_run_v2_service.api.name
  role     = "roles/run.admin"
  member   = "serviceAccount:${google_service_account.deploy.email}"
}

resource "google_cloud_run_v2_service_iam_member" "deploy_manages_web" {
  project  = var.gcp_project_id
  location = var.gcp_region
  name     = google_cloud_run_v2_service.web.name
  role     = "roles/run.admin"
  member   = "serviceAccount:${google_service_account.deploy.email}"
}

# `gcloud run deploy` attaches the runtime SA to each new revision, which requires this
# on the runtime SA specifically — not a blanket iam.serviceAccountUser on the project.
resource "google_service_account_iam_member" "deploy_actas_runtime" {
  service_account_id = google_service_account.runtime.name
  role               = "roles/iam.serviceAccountUser"
  member             = "serviceAccount:${google_service_account.deploy.email}"
}

# --- Workload Identity Federation: GitHub Actions impersonates `deploy` with no long-lived key. ---

resource "google_iam_workload_identity_pool" "github" {
  project                   = var.gcp_project_id
  workload_identity_pool_id = "github-actions"
  display_name              = "GitHub Actions"
  description               = "Federates GitHub Actions OIDC tokens; no JSON service-account key ever leaves GCP."

  depends_on = [google_project_service.this]
}

resource "google_iam_workload_identity_pool_provider" "github" {
  project                            = var.gcp_project_id
  workload_identity_pool_id          = google_iam_workload_identity_pool.github.workload_identity_pool_id
  workload_identity_pool_provider_id = "github"
  display_name                       = "GitHub"

  attribute_mapping = {
    "google.subject"       = "assertion.sub"
    "attribute.repository" = "assertion.repository"
    "attribute.ref"        = "assertion.ref"
  }

  # Restricts impersonation to this exact repository. A workflow run from a fork, or from any
  # other repo, presents a token the pool accepts but this condition then rejects.
  attribute_condition = "assertion.repository == \"${var.github_repository}\""

  oidc {
    issuer_uri = "https://token.actions.githubusercontent.com"
  }
}

resource "google_service_account_iam_member" "github_impersonates_deploy" {
  service_account_id = google_service_account.deploy.name
  role               = "roles/iam.workloadIdentityUser"
  member             = "principalSet://iam.googleapis.com/${google_iam_workload_identity_pool.github.name}/attribute.repository/${var.github_repository}"
}
