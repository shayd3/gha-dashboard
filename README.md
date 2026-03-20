# GHA Dashboard

Single pane of glass for monitoring GitHub Actions workflow statuses across multiple organizations and repositories.

## Features

- Monitor workflow runs across multiple orgs and repos in one view
- Filter runs by status, branch, workflow name, or event
- **Upstream fork runs** — when a selected repo is a fork, workflow runs from the upstream (parent) repo triggered by the authenticated user are automatically fetched and displayed inline with an "upstream" badge. This lets open-source contributors see CI results from upstream repos triggered by their PRs
- **Named views** — save your current repo selection and filters as a named view, switch instantly from the sidebar, synced across devices via PostgreSQL
- **Editable views** — modify a view's repos or filters by changing the dashboard while a view is active; a dirty indicator and "Save changes" button appear in the sidebar. Switching views while unsaved prompts to Save & Switch, Discard, or Cancel

## Tech Stack

- **Frontend**: Vue 3, Vite, PrimeVue, Pinia
- **Backend**: Fastify, octokit
- **Auth**: GitHub App (user-to-server OAuth) with JWT session cookies
- **Database**: PostgreSQL (views persistence)
- **Shared**: TypeScript types across frontend/backend
- **Deployment**: Docker, Helm

Monorepo managed with pnpm workspaces (`packages/shared`, `packages/backend`, `packages/frontend`).

## Prerequisites

- Node.js 20+
- pnpm 10+
- A [GitHub App](https://github.com/settings/apps) (see **GitHub App Setup** below)
- PostgreSQL 14+ (optional — for views persistence; without it, views are in-memory only)

## Setup

```bash
cp .env.example .env
```

Fill in your `.env`:

```
GITHUB_APP_CLIENT_ID=...
GITHUB_APP_CLIENT_SECRET=...
JWT_SECRET=<random-string>
# Optional: omit to use in-memory view storage (not persisted across restarts)
DATABASE_URL=postgresql://gha:gha@localhost:5432/gha_dashboard
# Optional: for future installation-token features
# GITHUB_APP_ID=...
# GITHUB_APP_PRIVATE_KEY=...
```

Start a local Postgres instance (or use the Docker Compose service):

```bash
docker compose up db -d
```

Install and run:

```bash
pnpm install
pnpm dev
```

This starts the backend on `:3000` and frontend on `:5173`. The Vite dev server proxies `/api` requests to the backend.

## Project Structure

```
packages/
  shared/     Shared TypeScript types
  backend/    Fastify API — auth, GitHub API proxy, caching, views
  frontend/   Vue 3 SPA — dashboard UI
docker/       Dockerfiles + nginx config
deploy/helm/  Helm chart for K8s deployment
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `GITHUB_APP_CLIENT_ID` | Yes | GitHub App client ID |
| `GITHUB_APP_CLIENT_SECRET` | Yes | GitHub App client secret |
| `JWT_SECRET` | Yes | Random string for signing JWT session cookies |
| `DATABASE_URL` | No | PostgreSQL connection string, e.g. `postgresql://user:pass@localhost:5432/gha_dashboard`. If not set, views are stored in-memory only (not persisted across restarts) and a warning is logged. |
| `GITHUB_APP_ID` | No | GitHub App numeric ID (reserved for future installation-token features) |
| `GITHUB_APP_PRIVATE_KEY` | No | GitHub App PEM private key (reserved for future installation-token features) |
| `GITHUB_API_URL` | No | GitHub Enterprise API endpoint (default: `https://api.github.com`) |
| `FRONTEND_URL` | No | Where the frontend is served (for OAuth callback & redirect). Default: `http://localhost:5173`. Docker Compose: `http://localhost`. Production: `https://your-domain.com` |
| `CORS_ORIGIN` | No | Allowed origin for CORS — should match `FRONTEND_URL` (default: `http://localhost:5173`) |
| `PORT` | No | Backend port (default: `3000`) |

## API Routes

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/auth/login` | Redirect to GitHub OAuth |
| GET | `/api/auth/callback` | OAuth callback, sets session cookie |
| GET | `/api/auth/me` | Current user info |
| POST | `/api/auth/logout` | Clear session |
| GET | `/api/orgs` | List user's organizations |
| GET | `/api/orgs/:org/repos` | List repos in an org |
| GET | `/api/repos/:owner/:repo/workflows` | List workflows for a repo |
| GET | `/api/repos/:owner/:repo/runs` | List runs for a repo |
| GET | `/api/runs?repos=org/repo1,org/repo2&upstream_repos=upstream/repo:actor:fork/repo` | Aggregated runs across repos (with optional upstream fork runs filtered by actor) |
| GET | `/api/health` | Health check |
| GET | `/api/views` | List saved views for the authenticated user |
| POST | `/api/views` | Create a view (`{ name, repos, filters? }`) — 201 on success, 409 on duplicate name, 400 if over 20-view limit |
| PUT | `/api/views/:id` | Update a view (name, repos, filters, position) |
| DELETE | `/api/views/:id` | Delete a view — 204 on success |

## Docker

```bash
docker compose up --build
```

Frontend serves on `:80`, backend on `:3000`. Nginx proxies `/api` to the backend container.

The `db` service runs PostgreSQL 16 and exposes no ports externally. The backend waits for `pg_isready` before starting.

**Note:** `docker compose down -v` will delete the `pgdata` volume and all stored views.

## Helm

```bash
helm install gha-dashboard ./deploy/helm/gha-dashboard \
  --set github.appClientId=YOUR_APP_CLIENT_ID \
  --set github.appClientSecret=YOUR_APP_CLIENT_SECRET \
  --set jwt.secret=YOUR_JWT_SECRET \
  --set database.url='postgresql://user:pass@your-postgres-host:5432/gha_dashboard' \
  --set ingress.host=gha-dashboard.your-domain.com
```

`database.url` is stored in the Kubernetes Secret alongside other credentials. For production, use a managed PostgreSQL service (RDS, Cloud SQL, Azure Database, etc.) and set `database.url` to its connection string. If `database.url` is left empty, the backend falls back to in-memory view storage.

See `deploy/helm/gha-dashboard/values.yaml` for all configurable values (replicas, resources, TLS, GitHub Enterprise API URL, etc).

## CI And Release Automation

The repository includes two GitHub Actions workflows:

- `CI` runs on pushes to `main`, pull requests targeting `main`, and manual dispatch. It installs dependencies, typechecks the workspace, runs the backend test suite with coverage, and builds all packages.
- `Release` runs when you push a Git tag matching `v*` (for example `v1.0.1`). It re-runs verification, builds and pushes backend/frontend Docker images to GHCR, packages the Helm chart, publishes it to GHCR as an OCI artifact, and creates a GitHub Release with the chart attached.

To cut a release:

```bash
git tag -a v1.0.1 -m "v1.0.1"
git push origin v1.0.1
```

By default, images are published to:

- `ghcr.io/shayd3/gha-dashboard-backend`
- `ghcr.io/shayd3/gha-dashboard-frontend`

The Helm chart is published to:

- `oci://ghcr.io/shayd3/charts/gha-dashboard`

Users can install from the OCI registry directly:

```bash
helm registry login ghcr.io
helm install gha-dashboard oci://ghcr.io/shayd3/charts/gha-dashboard \
  --version 1.0.0 \
  --set github.appClientId=YOUR_APP_CLIENT_ID \
  --set github.appClientSecret=YOUR_APP_CLIENT_SECRET \
  --set jwt.secret=YOUR_JWT_SECRET \
  --set database.url='postgresql://user:pass@host:5432/gha_dashboard' \
  --set ingress.host=gha-dashboard.example.com
```

If you prefer, the GitHub Release assets page still includes the packaged chart `.tgz` for manual download and installation.

## Data Persistence

Views are stored in PostgreSQL in the `views` table. The table is created automatically on backend startup via an idempotent `CREATE TABLE IF NOT EXISTS` migration — no migration tool is required.

`DATABASE_URL` is **optional**. If it is not set the backend starts normally, logs a warning, and stores views in-memory — they will be lost on restart. This is convenient for local development or demos where persistence is not needed.

**Local dev with persistence:** `docker compose up db -d` starts a Postgres container. The `DATABASE_URL` in `.env` should point to it.

**Production:** Use a managed PostgreSQL service (AWS RDS, GCP Cloud SQL, Azure Database for PostgreSQL, etc.) and set `DATABASE_URL` (or the Helm `database.url` value) to the connection string. The backend is stateless and horizontally scalable — multiple replicas can share one PostgreSQL instance.

## Caching

In-memory TTL cache (no external dependencies for MVP):

- Orgs/repos: 5 min
- Workflow runs: 60 sec
- Upstream fork runs: 60 sec (keyed by upstream repo + actor)

Cache is per-user, keyed by `userId:endpoint`.

## GitHub App Setup

1. Go to **Settings → Developer settings → GitHub Apps → New GitHub App**
2. Set the **Callback URL** to `http://localhost:5173/api/auth/callback` (for local dev) or your production URL
3. Under **Permissions**:
   - Repository: **Actions** → Read-only, **Metadata** → Read-only (auto-selected)
   - Organization: **Members** → Read-only
4. After creating the app, note the **Client ID** and generate a **Client secret**
   - User-to-server token expiration is enabled by default for new GitHub Apps — the dashboard handles refresh automatically
6. Install the app on the organizations/accounts whose repos you want to monitor

> **Note:** Users will only see repos at the intersection of "repos they personally have access to" and "repos where the GitHub App is installed." This is more secure than a blanket OAuth scope.

## GitHub Enterprise

Set `GITHUB_API_URL` in your `.env` to your GHE API endpoint (e.g. `https://github.yourcompany.com/api/v3`). GitHub EMU (Enterprise Managed Users) on github.com is also supported.
