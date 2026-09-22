# 0008 — Deploy: GCP Cloud Run + MongoDB Atlas, provisioned with Terraform

**Status:** Accepted, infrastructure code only — not yet applied (2026-09-22)

## Context

T13 gave us a working full-stack `docker-compose` image set. Decision 15 in `tasks/plan.md` already
settled the target shape: two Cloud Run services (`orders-api`, `orders-web`), MongoDB Atlas M0 in the
same region, images in Artifact Registry, secrets in Secret Manager, and CI authenticating to GCP via
Workload Identity Federation (no long-lived JSON keys). T14 turns that decision into `infra/terraform`.

Provisioning real cloud infrastructure needs a real GCP project (with billing enabled) and a real Atlas
organization — decisions that belong to whoever owns the account, not to whoever is writing the Terraform.
This task was scoped with the user to **write and validate the Terraform, but not run `terraform apply`**;
that step waits for a GCP project id and an Atlas organization id to be supplied, and can happen in a
follow-up once they are. `terraform fmt -check` and `terraform validate` (against the real provider
schemas, downloaded locally) are the verification that stands in for tests here — there is no `plan`
without live credentials.

## Decision

- **Two `google_cloud_run_v2_service` resources**, `orders-api` (port 3000) and `orders-web` (port 8080,
  matching the Dockerfiles from T13), `min_instance_count = 0`, `max_instance_count` capped at 2 via
  `var.cloud_run_max_instances`. Ingress `INGRESS_TRAFFIC_ALL` and a `roles/run.invoker` binding for
  `allUsers` on both — this is a demo app with no auth layer of its own, so there is nothing an IAM-gated
  ingress would protect that the app itself doesn't already leave open.
- **Terraform owns the service shape, CI owns the image.** Both services start with a placeholder
  image (`us-docker.pkg.dev/cloudrun/container/hello`, Google's own hello-world) so the first `apply` has
  something to deploy, and `lifecycle { ignore_changes = [template[0].containers[0].image] }` means a later
  `terraform plan` never proposes reverting the image the deploy workflow (T15) pushed. This mirrors the
  same split already used for `docker-compose.yml` vs. the Dockerfiles.
- **Two service accounts, least privilege, never shared:** `orders-runtime` (what Cloud Run assumes to
  serve requests — only `roles/secretmanager.secretAccessor` on the one `DATABASE_URL` secret) and
  `orders-deploy` (what GitHub Actions assumes to ship a release — `roles/artifactregistry.writer`,
  `roles/run.admin` scoped to the two named services via `google_cloud_run_v2_service_iam_member`, and
  `roles/iam.serviceAccountUser` on `orders-runtime` specifically, not a project-wide grant, because
  `gcloud run deploy` needs to attach the runtime identity to each new revision).
- **Workload Identity Federation, not a service-account key.** A `google_iam_workload_identity_pool` +
  `google_iam_workload_identity_pool_provider` federate GitHub's OIDC tokens, with
  `attribute_condition = "assertion.repository == \"amsik/mm-store-apps-orders\""` so only workflow runs
  from this exact repository (not a fork, not a differently-named clone) can impersonate `orders-deploy`.
- **Secret Manager holds one secret, `orders-database-url`.** Its value is composed from the Atlas
  connection string plus a Terraform-generated `random_password` (32 chars, alphanumeric only — a
  connection-string password with special characters would need percent-encoding, so the character set is
  restricted instead) for a dedicated `orders-api` database user scoped to `roles { role_name = "readWrite"
  database_name = var.db_name }` — read/write on the app's one database, nothing else in the project.
- **Atlas M0 (free tier)** via `mongodbatlas_advanced_cluster` with `provider_name = "TENANT"` and
  `backing_provider_name = "GCP"`. The older `mongodbatlas_cluster` resource still exists in provider
  v2.18 but is the one being phased out in favor of `advanced_cluster`, which is also where new features
  land; using it now avoids a resource-rename migration later. One M0 cluster is allowed per Atlas project,
  which is fine here — one project, one cluster.
- **`mongodbatlas_project_ip_access_list` allows `0.0.0.0/0`.** Cloud Run has no static egress IP, so a
  narrower allowlist isn't possible without a VPC connector and Cloud NAT, which decision 15 already ruled
  out as overkill for a demo. TLS and SCRAM authentication are the actual boundary, same as decision 15
  states for the whole deploy shape.
- **Remote state in a GCS bucket**, referenced with an empty `backend "gcs" {}` block and `-backend-config`
  at `init` time, because the bucket name is project-specific and shouldn't be hardcoded into version
  control. `infra/README.md` documents the one-time bucket creation (the chicken-and-egg problem: the
  bucket that holds Terraform's state can't itself be created by that same Terraform run).

## Alternatives

- **GKE:** full control over the runtime, but a cluster, node pools and its own upgrade cadence are a lot
  of surface for two stateless services in a demo.
- **App Engine:** simpler than GKE, but a second, more opinionated deployment model with fewer of Cloud
  Run's container-native conveniences (arbitrary Dockerfiles, per-revision traffic splitting).
- **Firebase Hosting for the web app:** would serve static files well, but adds a second deploy toolchain
  next to Cloud Run for the API; one platform keeps the pipeline uniform, which matters more here than
  Firebase's edge-CDN benefits.
- **A service-account JSON key in a GitHub secret**, instead of Workload Identity Federation: simpler to
  wire up, but a long-lived credential that has to be manually rotated and can leak from logs or a
  misconfigured `echo`. WIF tokens are short-lived and scoped to one repository by construction.
- **`mongodbatlas_cluster` instead of `mongodbatlas_advanced_cluster`:** less new HCL syntax (nested blocks
  instead of the newer list-of-objects attributes), but it's the resource Atlas is moving away from.

## Consequences

- `terraform apply` has not been run. Until it is, there is no live Cloud Run URL, no live Atlas cluster,
  and T15 (the deploy workflow) and the cold-start measurement it calls for cannot start. This ADR's status
  will move to "Accepted, applied" once that happens.
- `var.atlas_region` needs to match `var.gcp_region` under Atlas's own GCP region naming (e.g.
  `europe-west1` → `EUROPE_WEST_1`); that mapping should be double-checked against Atlas's current
  supported region list right before the first `apply`, since it can only be verified against the live
  API, not `terraform validate`.
- The deploy workflow (T15) must build the `orders-web` image with `VITE_API_URL` pointing at
  `orders-api`'s Cloud Run URL (a Terraform output). That means the API is deployed first, its URL is read
  from Terraform output or `gcloud run services describe`, and only then is the web image built — an
  ordering constraint T15 has to encode explicitly.
- Cold-start time (NestJS + Prisma boot) has not been measured yet; that's also deferred to T15, once a
  revision actually exists to measure.
