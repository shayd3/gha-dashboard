# GHA Dashboard

Single pane of glass for monitoring GitHub Actions workflow statuses across multiple organizations and repositories.

## Tech Stack

- **Frontend**: Vue 3, Vite, PrimeVue, Pinia
- **Backend**: Fastify, octokit
- **Auth**: GitHub OAuth with JWT session cookies
- **Shared**: TypeScript types across frontend/backend
- **Deployment**: Docker, Helm

Monorepo managed with pnpm workspaces (`packages/shared`, `packages/backend`, `packages/frontend`).

## Prerequisites

- Node.js 20+
- pnpm 10+
- A [GitHub OAuth App](https://github.com/settings/developers) with callback URL `http://localhost:5173/api/auth/callback` (for local dev)

## Setup

```bash
cp .env.example .env
```

Fill in your `.env`:

```
GITHUB_CLIENT_ID=...
GITHUB_CLIENT_SECRET=...
JWT_SECRET=<random-string>
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
  backend/    Fastify API — auth, GitHub API proxy, caching
  frontend/   Vue 3 SPA — dashboard UI
docker/       Dockerfiles + nginx config
deploy/helm/  Helm chart for K8s deployment
```

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
| GET | `/api/runs?repos=org/repo1,org/repo2` | Aggregated runs across repos |
| GET | `/api/health` | Health check |

## Docker

```bash
docker compose up --build
```

Frontend serves on `:80`, backend on `:3000`. Nginx proxies `/api` to the backend container.

## Helm

```bash
helm install gha-dashboard ./deploy/helm/gha-dashboard \
  --set github.clientId=YOUR_ID \
  --set github.clientSecret=YOUR_SECRET \
  --set jwt.secret=YOUR_JWT_SECRET \
  --set ingress.host=gha-dashboard.your-domain.com
```

See `deploy/helm/gha-dashboard/values.yaml` for all configurable values (replicas, resources, TLS, GitHub Enterprise API URL, etc).

## Caching

In-memory TTL cache (no external dependencies for MVP):

- Orgs/repos: 5 min
- Workflow runs: 60 sec

Cache is per-user, keyed by `userId:endpoint`.

## GitHub Enterprise

Set `GITHUB_API_URL` in your `.env` to your GHE API endpoint (e.g. `https://github.yourcompany.com/api/v3`).
