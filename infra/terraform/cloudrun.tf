locals {
  # Cloud Run needs *some* image at the very first apply, before CI has ever built one. Every
  # container's `lifecycle.ignore_changes` below means terraform never reverts the real image
  # the deploy workflow (T15) pushes afterwards — terraform owns the service shape, CI owns the image.
  placeholder_image = "us-docker.pkg.dev/cloudrun/container/hello"
}

resource "google_cloud_run_v2_service" "api" {
  project  = var.gcp_project_id
  name     = "orders-api"
  location = var.gcp_region
  ingress  = "INGRESS_TRAFFIC_ALL"

  template {
    service_account = google_service_account.runtime.email

    scaling {
      min_instance_count = 0
      max_instance_count = var.cloud_run_max_instances
    }

    containers {
      image = local.placeholder_image

      ports {
        container_port = 3000
      }

      env {
        name  = "NODE_ENV"
        value = "production"
      }
      env {
        name  = "PORT"
        value = "3000"
      }
      env {
        name  = "LOG_LEVEL"
        value = "info"
      }
      env {
        name  = "GRAPHQL_INTROSPECTION"
        value = "false"
      }
      env {
        name  = "GRAPHQL_MAX_DEPTH"
        value = "8"
      }
      env {
        # The web service's own URL, known only once it exists — the two services form one
        # direction of dependency (api -> web), never the reverse.
        name  = "CORS_ORIGINS"
        value = google_cloud_run_v2_service.web.uri
      }
      env {
        name = "DATABASE_URL"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.database_url.secret_id
            version = "latest"
          }
        }
      }
    }
  }

  lifecycle {
    ignore_changes = [template[0].containers[0].image]
  }

  depends_on = [
    google_project_service.this,
    google_secret_manager_secret_iam_member.runtime_reads_database_url,
  ]
}

resource "google_cloud_run_v2_service" "web" {
  project  = var.gcp_project_id
  name     = "orders-web"
  location = var.gcp_region
  ingress  = "INGRESS_TRAFFIC_ALL"

  template {
    scaling {
      min_instance_count = 0
      max_instance_count = var.cloud_run_max_instances
    }

    containers {
      image = local.placeholder_image

      ports {
        container_port = 8080
      }
    }
  }

  lifecycle {
    ignore_changes = [template[0].containers[0].image]
  }

  depends_on = [google_project_service.this]
}

# Public invoker on both: a demo app with no auth layer of its own.
resource "google_cloud_run_v2_service_iam_member" "api_public" {
  project  = var.gcp_project_id
  location = var.gcp_region
  name     = google_cloud_run_v2_service.api.name
  role     = "roles/run.invoker"
  member   = "allUsers"
}

resource "google_cloud_run_v2_service_iam_member" "web_public" {
  project  = var.gcp_project_id
  location = var.gcp_region
  name     = google_cloud_run_v2_service.web.name
  role     = "roles/run.invoker"
  member   = "allUsers"
}
