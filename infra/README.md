# Infrastructure (Terraform)

Provisions the demo's GCP + MongoDB Atlas infrastructure: Artifact Registry, two Cloud Run services
(`orders-api`, `orders-web`), a Secret Manager secret, the two least-privilege service accounts, GitHub
Actions Workload Identity Federation, and an Atlas project with an M0 cluster. See
[`docs/adr/0008-deploy-gcp-cloud-run-terraform.md`](../docs/adr/0008-deploy-gcp-cloud-run-terraform.md) for
why it's shaped this way.

**Status:** applied, against GCP project `mediamarkt-challange` — see [`docs/adr/0008`](../docs/adr/0008-deploy-gcp-cloud-run-terraform.md)
for when and what that first `apply` caught. Both Cloud Run services and the Atlas cluster exist; the
deploy workflow (T15, [`docs/deploy.md`](../docs/deploy.md)) is what pushes real images to them.

## Prerequisites

- [Terraform](https://developer.hashicorp.com/terraform/install) ≥ 1.9 and the [gcloud CLI](https://cloud.google.com/sdk/docs/install), authenticated (`gcloud auth application-default login`).
- A GCP project with billing enabled.
- A MongoDB Atlas organization, and an [organization API key](https://www.mongodb.com/docs/atlas/configure-api-access/#organization-api-keys) with at least `Organization Project Creator`.

## One-time bootstrap

Terraform's own state has to live somewhere before Terraform can manage anything — a GCS bucket, created
once by hand (the chicken-and-egg problem the state backend can't solve for itself):

```bash
PROJECT_ID="<your gcp project id>"
BUCKET="${PROJECT_ID}-tfstate"

gcloud storage buckets create "gs://${BUCKET}" \
  --project "${PROJECT_ID}" --location europe-west1 --uniform-bucket-level-access
gcloud storage buckets update "gs://${BUCKET}" --versioning
```

## Configure

```bash
cd infra/terraform
cp terraform.tfvars.example terraform.tfvars   # fill in gcp_project_id and atlas_org_id

export MONGODB_ATLAS_PUBLIC_KEY="<atlas api public key>"
export MONGODB_ATLAS_PRIVATE_KEY="<atlas api private key>"   # never put these in terraform.tfvars

terraform init -backend-config="bucket=${BUCKET}"
```

## Apply

```bash
terraform plan   # review before applying anything real
terraform apply
```

The first apply deploys both Cloud Run services with a placeholder image
(`us-docker.pkg.dev/cloudrun/container/hello`) — real images arrive once the deploy workflow (T15) runs.
A second `terraform plan` right after `apply` should show **no changes**.

Useful outputs afterwards:

```bash
terraform output api_url                       # orders-api's public URL
terraform output web_url                       # orders-web's public URL
terraform output workload_identity_provider     # for google-github-actions/auth in the deploy workflow
terraform output deploy_service_account_email   # ditto
```

`workload_identity_provider` and `deploy_service_account_email` are what T15's deploy workflow needs as
repository variables — no secrets, since WIF is keyless.

## CI

Every PR runs `terraform fmt -check` and `terraform validate` (`.github/workflows/ci.yml`, `terraform`
job) against the provider schemas, with no cloud credentials and no backend. `terraform plan` in CI, shown
as a PR comment when `infra/**` changes, is left for once real credentials exist to run it against
(`apply` itself stays a manual/local step — see decision 15 in `tasks/plan.md`).

## Notes

- `var.atlas_region` must be Atlas's name for the same physical region as `var.gcp_region`. Atlas's GCP
  naming isn't always a mechanical transform: `europe-west1` (Belgium, the default) is `WESTERN_EUROPE`,
  not `EUROPE_WEST_1` — that wrong guess is exactly what failed on the first real `apply` (INVALID_ATTRIBUTE
  on `regionName`). If you change `gcp_region`, look up the matching Atlas name at
  https://www.mongodb.com/docs/atlas/reference/google-gcp/ first; `terraform validate` can't catch this,
  only the live API can.
- `terraform destroy` removes the Atlas cluster and project along with everything else here — treat it
  with the same care as any other irreversible database operation.
