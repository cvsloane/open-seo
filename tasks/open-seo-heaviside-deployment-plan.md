# OpenSEO Heaviside Deployment Plan

## Outcome

Run OpenSEO as a standalone Heaviside service on `apps-vps`, backed by a dedicated `open_seo` PostgreSQL database and role on `db-vps`, with DataForSEO access retrieved from Bitwarden.

The initial service is private to the Heaviside tailnet. A later, separately reviewed piece can absorb or expose proven OpenSEO capability inside HeavisideOS through an explicit service or module contract.

## Non-goals

- No HG Market Report database, API, webhook, environment, deployment, or runtime dependency.
- No shared database tables or direct cross-database reads between OpenSEO and HeavisideOS.
- No public route or new end-user authentication in the initial deployment.
- No HeavisideOS code changes in the deployment piece.

## Canonical base

- Upstream: `every-app/open-seo`
- Upstream base: `c469a48` on `main`
- Heaviside working checkout: `/home/cvsloane/dev/open-seo`
- Heaviside fork: `cvsloane/open-seo`

## Ordered pieces

### 1. Docker PostgreSQL support

Add the smallest runtime change needed for the Docker image to accept a direct PostgreSQL URL, apply the existing PostgreSQL migrations on startup, and preserve the existing Cloudflare Hyperdrive path.

Proof owed:

- One provider-selection test for direct Docker PostgreSQL versus Hyperdrive.
- Existing focused database/provider tests.
- Production image build completes.

### 2. Standalone infrastructure deployment

Provision a dedicated `open_seo` database/role on `db-vps`, store the new database URLs in the Infrastructure Bitwarden project, configure DataForSEO from the authorized credential source, and deploy the fork on `apps-vps` with tailnet-only access and telemetry disabled.

Proof owed:

- PostgreSQL migrations exist in the dedicated database.
- OpenSEO `/api/health` reports healthy database/configuration state.
- The free DataForSEO account endpoint succeeds from the deployed runtime.
- Runtime configuration contains no HG Market Report variables or endpoints.

### 3. Future HeavisideOS capability integration

After OpenSEO has been used and evaluated, define which capability belongs natively in HOS and whether the transition uses a bounded internal API/MCP contract or a direct module port. Keep identity, tenant mapping, authorization, cost controls, and data ownership in HOS.

This piece is not authorized by the current installation request and remains pending.

## Authority and safety

- Authorized: non-destructive code changes, fork creation, tests, dedicated database/role creation, migrations, Bitwarden secret creation, apps-vps deployment, and verification required for this install.
- Not authorized: deleting or overwriting existing data, changing HG Market Report, changing HeavisideOS behavior, making OpenSEO public, or cutting over any existing SEO workflow.
- Database DDL uses the direct `db-vps:5432` URL. The running app uses PgBouncer on `db-vps:6543`.

## Current piece

Piece 2: Standalone infrastructure deployment.

Piece 1 landed on branch `heaviside/postgres-selfhost`. Focused provider/retry
tests passed, TypeScript passed, and the production Dockerfile built image
`sha256:456a9c29bcc0507188836a9760c6c367b88a1a9f7ebe24ba45f334c8f790124c`.

## Next piece

Provision and deploy the standalone service on `db-vps` and `apps-vps`.
