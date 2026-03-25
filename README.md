<div align="center">

# GHA Dashboard

**A single pane of glass for monitoring GitHub Actions across your organizations**

Track workflow runs · Filter by status, branch, and event · Save named views · Sync across devices

[![Vue](https://img.shields.io/badge/Vue-3-4FC08D?style=flat-square&logo=vue.js&logoColor=white)](https://vuejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://typescriptlang.org)
[![Fastify](https://img.shields.io/badge/Fastify-5-000000?style=flat-square&logo=fastify&logoColor=white)](https://fastify.dev)
[![Helm](https://img.shields.io/badge/Helm-chart-0F1689?style=flat-square&logo=helm&logoColor=white)](deploy/helm/gha-dashboard)
[![Docker](https://img.shields.io/badge/Docker-ready-2496ED?style=flat-square&logo=docker&logoColor=white)](docker)
[![CI](https://github.com/shayd3/gha-dashboard/actions/workflows/ci.yml/badge.svg)](https://github.com/shayd3/gha-dashboard/actions/workflows/ci.yml)

</div>

---

## Features

- **Multi-org monitoring** — view workflow runs across multiple organizations and repositories in one place
- **Upstream fork runs** — when a repo is a fork, runs from the upstream triggered by your user are fetched and shown inline with an "upstream" badge
- **Named views** — save your current repo selection and filters as a named view, switchable from the sidebar
- **Editable views** — modify a view's repos or filters on the fly; a dirty indicator and "Save changes" button appear when unsaved
- **Persistent views** — views sync across devices via PostgreSQL (optional; falls back to in-memory)
- **GitHub Enterprise** — configurable API URL for GHE and EMU environments

## Quick Start

```bash
cp .env.example .env   # fill in GITHUB_APP_CLIENT_ID, GITHUB_APP_CLIENT_SECRET, JWT_SECRET
docker compose up --build
```

Open [http://localhost](http://localhost). See [GitHub App Setup](docs/github-app.md) to create the OAuth app first.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Vue 3, Vite, PrimeVue, Pinia |
| Backend | Fastify, Octokit |
| Auth | GitHub App (user-to-server OAuth), JWT session cookies |
| Database | PostgreSQL (optional — views persistence) |
| Deployment | Docker Compose, Helm (Kubernetes) |

Monorepo managed with pnpm workspaces (`packages/shared`, `packages/backend`, `packages/frontend`).

## Local Development

**Prerequisites:** Node.js 20+, pnpm 10+, a [GitHub App](docs/github-app.md)

```bash
pnpm install
pnpm dev
```

Backend starts on `:3000`, frontend on `:5173`. The Vite dev server proxies `/api` to the backend.

Optionally start a local Postgres instance for view persistence:

```bash
docker compose up db -d
```

## Documentation

| Guide | Description |
|-------|-------------|
| [GitHub App Setup](docs/github-app.md) | Create and configure the GitHub App for OAuth |
| [Environment Variables](docs/environment-variables.md) | All supported env vars and their defaults |
| [Docker](docs/docker.md) | Running with Docker Compose |
| [Helm](docs/helm.md) | Deploying to Kubernetes with Helm |
| [API Reference](docs/api.md) | Backend REST API routes |

## CI & Releases

Two GitHub Actions workflows are included:

- **CI** — runs on push to `main` and pull requests: typecheck, backend tests, full build
- **Release** — triggered by `v*` tags: builds and pushes Docker images to GHCR, packages and publishes the Helm chart as an OCI artifact, creates a GitHub Release

To cut a release:

```bash
git tag v1.0.1
git push origin v1.0.1
```

Images are published to `ghcr.io/shayd3/gha-dashboard-{backend,frontend}`.
Helm chart is published to `oci://ghcr.io/shayd3/charts/gha-dashboard`.
