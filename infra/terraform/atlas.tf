resource "mongodbatlas_project" "this" {
  name   = "mm-store-apps-orders"
  org_id = var.atlas_org_id
}

# Cloud Run has no static egress IP, so a narrower allowlist isn't possible without a VPC
# connector + Cloud NAT — out of scope for a demo (decision 15 in tasks/plan.md). Atlas still
# enforces TLS and SCRAM auth on every connection.
resource "mongodbatlas_project_ip_access_list" "anywhere" {
  project_id = mongodbatlas_project.this.id
  cidr_block = "0.0.0.0/0"
  comment    = "Cloud Run has no static egress IP; TLS + SCRAM auth are the real boundary."
}

# M0 (free tier): provider_name "TENANT" + backing_provider_name is how Atlas represents the
# shared/free tier. One M0 cluster per project.
resource "mongodbatlas_advanced_cluster" "this" {
  project_id   = mongodbatlas_project.this.id
  name         = "orders"
  cluster_type = "REPLICASET"

  replication_specs = [
    {
      region_configs = [
        {
          provider_name         = "TENANT"
          backing_provider_name = "GCP"
          region_name           = var.atlas_region
          priority              = 7
          electable_specs = {
            instance_size = "M0"
          }
        },
      ]
    },
  ]
}

resource "random_password" "db_user" {
  length = 32
  # Kept alphanumeric on purpose: a connection-string password with special characters needs
  # percent-encoding, and this way it never does.
  special = false
}

resource "mongodbatlas_database_user" "api" {
  project_id         = mongodbatlas_project.this.id
  username           = "orders-api"
  password           = random_password.db_user.result
  auth_database_name = "admin"

  roles {
    role_name     = "readWrite"
    database_name = var.db_name
  }
}
