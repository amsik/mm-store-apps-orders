resource "google_secret_manager_secret" "database_url" {
  project   = var.gcp_project_id
  secret_id = "orders-database-url"

  replication {
    auto {}
  }

  depends_on = [google_project_service.this]
}

resource "google_secret_manager_secret_version" "database_url" {
  secret = google_secret_manager_secret.database_url.id
  secret_data = format(
    "mongodb+srv://%s:%s@%s/%s?retryWrites=true&w=majority",
    mongodbatlas_database_user.api.username,
    random_password.db_user.result,
    trimprefix(mongodbatlas_advanced_cluster.this.connection_strings.standard_srv, "mongodb+srv://"),
    var.db_name,
  )
}
