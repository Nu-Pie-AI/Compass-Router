# Google Cloud Deployment Templates

These files are preparation artifacts only. They do not deploy services or
create billable resources.

The staging API template is Neon-backed and uses separate pooled
`DATABASE_URL` and direct `DIRECT_DATABASE_URL` Secret Manager references.
The original API template retains its Cloud SQL annotation for production
compatibility; do not use it for the Neon staging branch.

Validate the templates locally before rendering them:

`python infra/gcp/validate_templates.py`

The check confirms that deployment placeholders are present, API secrets use
Cloud Run secret references, and common live-secret patterns are absent. It
does not prove that the referenced GCP resources or secret versions exist.

1. Create the GCP project, Artifact Registry repository, Cloud SQL instance,
   Redis service, service accounts, and Secret Manager entries.
2. Render the `.template` files with deployment-owned resource names and pinned
   Secret Manager version numbers. Never substitute secret values into YAML or
   commit rendered files. Cloud Run resolves environment-variable secrets when
   the revision starts, so version pinning makes rotation an explicit revision
   change.
3. Run the verification pipeline in `cloudbuild-verify.yaml`. It validates
   the deployment templates before running the API suite and image builds.
4. Apply Alembic migrations from a controlled release job using
   `DATABASE_MIGRATION_MODE=alembic`.
5. Deploy API and web services only after staging smoke tests and owner approval.
6. Run catalog synchronization as an authenticated Cloud Run Job using:

   `python -m app.catalog_sync --provider litellm`

7. Run reservation recovery in preview mode first. Applying recovery requires
   an explicit operator action:

   `python -m app.recovery --task recover-reservations --apply`

The API template explicitly enables production mode, Alembic migrations,
self-service signup, SMTP delivery, Razorpay billing, and proxy execution.
Secret-bearing settings (including the Compass SSO secret, admin password, and
SMTP credentials) reference pinned Secret Manager versions and do not contain
provider, Clerk, database, Redis, or Razorpay secret values.

For an owner-approved release artifact build, use the explicit BuildKit script
with a clean worktree and a real Artifact Registry repository:

`python infra/gcp/build_release.py --registry REGION-docker.pkg.dev/PROJECT/REPOSITORY --web-api-url https://api.example.invalid --marketplace-url https://marketplace.example.invalid`

The script tags both images with the Git commit, pushes with BuildKit
provenance and SBOM attestations enabled, and writes immutable digests to an
ignored `.release/release-manifest.json`. It does not deploy Cloud Run or
read application secrets. Use `--dry-run` to inspect commands without Docker,
registry access, or manifest output.
