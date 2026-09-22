# Deploying

`infra/terraform` provisions the _shape_ (Cloud Run services, Artifact Registry, IAM, Atlas — see
[`infra/README.md`](../infra/README.md) and [ADR 0008](adr/0008-deploy-gcp-cloud-run-terraform.md)).
`.github/workflows/deploy.yml` owns the _image_: it builds, deploys and promotes a new revision every
time `main` goes green.

## Pipeline (`.github/workflows/deploy.yml`)

Triggered by `workflow_run` once the `CI` workflow completes successfully on `main` — GitHub Actions has
no `needs:` across workflow files, so `workflow_run` is the cross-workflow equivalent. Per run, in order:

1. **Authenticate** to GCP via `google-github-actions/auth`, exchanging this run's OIDC token for
   short-lived credentials through Workload Identity Federation. No service-account key is stored
   anywhere — only two non-secret repository variables identify _which_ WIF provider and service account
   to use (see below).
2. **Build and push** `orders-api`'s image, tagged with the commit SHA.
3. **Deploy `orders-api` with `--no-traffic --tag=sha-<short-sha>`.** This creates a new revision and a
   revision-specific URL without touching what's currently serving the live traffic.
4. **Smoke test** that tagged URL (`scripts/smoke-test.js`): polls `{ health { status db } }` with
   backoff until the process is up _and_ its Mongo connection is ready (rides out the cold start), then
   runs one real `{ orders(first: 1) { ... } }` query to prove the whole graph — resolver, Prisma, Mongo —
   actually works. A GraphQL error or non-2xx response fails immediately, no retry.
5. **Build, push and deploy `orders-web`** the same way, with `VITE_API_URL` baked in at build time as
   `orders-api`'s _stable_ service URL (`status.url`, not the canary tag) — that hostname always resolves
   to whichever revision currently holds 100% of `orders-api`'s traffic, so it starts working the moment
   step 6 flips it. A plain `curl` confirms the web canary serves its `index.html`.
6. **Only once both canaries pass:** `gcloud run services update-traffic --to-latest` for `orders-api`,
   then `orders-web`. Every step before this one leaves production traffic exactly where it was — a failed
   smoke test fails the job and the previous revision keeps serving 100% of traffic, untouched.

The job summary records the wall-clock time from "canary deployed" to "canary healthy" as a proxy for
cold-start time (NestJS + Prisma boot, on Cloud Run's default CPU allocation). See ADR 0008's Consequences
section for the measured number from the first real run, and the mitigations (startup CPU boost,
`min-instances=1`) if it's a problem on demo day.

## Repository variables

No secrets are stored in GitHub for this pipeline — WIF is keyless. Two plain (non-secret) repo variables
tell `google-github-actions/auth` who to become; both come straight out of Terraform's outputs and only
change if the infrastructure is ever re-provisioned:

```bash
gh variable set WIF_PROVIDER --body "$(terraform -chdir=infra/terraform output -raw workload_identity_provider)"
gh variable set DEPLOY_SA_EMAIL --body "$(terraform -chdir=infra/terraform output -raw deploy_service_account_email)"
```

## Rollback

Cloud Run keeps every revision. To roll back manually:

```bash
gcloud run revisions list --service orders-api --region europe-west1
gcloud run services update-traffic orders-api --region europe-west1 --to-revisions REVISION=100
```

Same for `orders-web`. No redeploy needed — the previous image is still the one running.

## Local alternative

`docker compose up --build` (see the root README) runs the same two images against a local `mongo`
container and needs no cloud access at all — the fallback for demo day if Cloud Run or Atlas is
unreachable.
