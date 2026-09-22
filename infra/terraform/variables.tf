variable "gcp_project_id" {
  description = "GCP project that hosts Cloud Run, Artifact Registry, Secret Manager and the deploy service account."
  type        = string
}

variable "gcp_region" {
  description = "GCP region for Artifact Registry and both Cloud Run services."
  type        = string
  default     = "europe-west1"
}

variable "github_repository" {
  description = "GitHub \"owner/repo\" allowed to impersonate the deploy service account through Workload Identity Federation."
  type        = string
  default     = "amsik/mm-store-apps-orders"
}

variable "atlas_org_id" {
  description = "MongoDB Atlas organization id that owns the project created for this app."
  type        = string
}

variable "atlas_region" {
  description = <<-EOT
    MongoDB Atlas GCP region name for the M0 cluster. Must be the same physical region as
    gcp_region (Atlas names it differently, e.g. europe-west1 -> EUROPE_WEST_1) — confirm the
    exact mapping against Atlas's current supported region list before the first apply.
  EOT
  type        = string
  default     = "EUROPE_WEST_1"
}

variable "db_name" {
  description = "Database name the API connects to; the database user is scoped to only this database."
  type        = string
  default     = "mm-order"
}

variable "cloud_run_max_instances" {
  description = "Upper bound on Cloud Run instances per service (cost and blast-radius control)."
  type        = number
  default     = 2
}
