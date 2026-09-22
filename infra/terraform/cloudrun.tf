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
      # No PORT here: Cloud Run reserves it and sets it itself from `ports.container_port` above.
      env {
        name  = "LOG_LEVEL"
        value = "info"
      }
      env {
        name  = "GRAPHQL_INTROSPECTION"
        value = "true"
      }
      env {
        name  = "GRAPHQL_MAX_DEPTH"
        value = "8"
      }
      env {
        # The web service's own URL, known only once it exists — the two services form one
        # direction of dependency (api -> web), never the reverse. Cloud Run serves every
        # service on two equivalent hostnames (this legacy hash-based one, plus a
        # project-number-based one below); both need to be allow-listed since either can end
        # up as the browser's origin.
        name = "CORS_ORIGINS"
        value = join(",", [
          google_cloud_run_v2_service.web.uri,
          "https://orders-web-${data.google_project.this.number}.${var.gcp_region}.run.app",
        ])
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
    # Without this, Cloud Run falls back to the project's default compute engine service
    # account, which `orders-deploy` has no `actAs` grant on (iam.tf scopes that grant to
    # `orders-runtime` specifically) — `gcloud run deploy orders-web` then fails with
    # PERMISSION_DENIED. Reusing `orders-runtime` here still means every non-default identity
    # in this project is one of exactly two, least-privilege, never-shared service accounts;
    # nginx never reads the one secret `orders-runtime` can access, so this is a plain
    # narrowing versus the default compute SA's usual broad project-level `roles/editor`.
    service_account = google_service_account.runtime.email

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
