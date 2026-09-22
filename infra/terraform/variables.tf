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
    gcp_region. Atlas's GCP naming isn't a mechanical uppercase-and-underscore of the GCP region:
    europe-west1 (Belgium) is "WESTERN_EUROPE", while europe-west2/3/4 do follow the pattern
    (EUROPE_WEST_2, ...). See https://www.mongodb.com/docs/atlas/reference/google-gcp/ for the
    full mapping if gcp_region is changed from the default.
  EOT
  type        = string
  default     = "WESTERN_EUROPE"
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
