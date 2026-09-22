output "api_url" {
  description = "Public URL of orders-api. Also the value to bake in as VITE_API_URL (plus /graphql) when building the web image — see docs/adr/0008."
  value       = google_cloud_run_v2_service.api.uri
}

output "web_url" {
  description = "Public URL of orders-web."
  value       = google_cloud_run_v2_service.web.uri
}

output "artifact_registry_repository" {
  description = "Full resource name of the Artifact Registry Docker repository CI pushes images to."
  value       = google_artifact_registry_repository.images.id
}

output "workload_identity_provider" {
  description = "Full resource name to pass as `workload_identity_provider` to google-github-actions/auth in the deploy workflow."
  value       = google_iam_workload_identity_pool_provider.github.name
}

output "deploy_service_account_email" {
  description = "Value to pass as `service_account` to google-github-actions/auth in the deploy workflow."
  value       = google_service_account.deploy.email
}

output "atlas_cluster_hostname" {
  description = "SRV hostname only, no credentials — for reference/debugging (mongosh, Compass)."
  value       = mongodbatlas_advanced_cluster.this.connection_strings.standard_srv
}
