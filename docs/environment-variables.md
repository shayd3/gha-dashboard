# Environment Variables

## Required

| Variable | Description |
|----------|-------------|
| `GITHUB_APP_CLIENT_ID` | GitHub App client ID |
| `GITHUB_APP_CLIENT_SECRET` | GitHub App client secret |
| `JWT_SECRET` | Random string used to sign JWT session cookies |

## Optional

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | _(none)_ | PostgreSQL connection string, e.g. `postgresql://user:pass@localhost:5432/gha_dashboard`. If not set, views are stored in-memory and lost on restart. |
| `FRONTEND_URL` | `http://localhost:5173` | Where the frontend is served — used for the OAuth `redirect_uri` and post-login redirect. Must match the callback URL registered in your GitHub App. |
| `CORS_ORIGIN` | `http://localhost:5173` | Allowed origin for CORS. Should match `FRONTEND_URL`. |
| `GITHUB_API_URL` | `https://api.github.com` | GitHub API base URL. Override for GitHub Enterprise (e.g. `https://github.yourcompany.com/api/v3`). |
| `PORT` | `3000` | Port the backend listens on. |
| `NODE_ENV` | `development` | Set to `production` in deployed environments. |
| `GITHUB_APP_ID` | _(none)_ | GitHub App numeric ID. Reserved for future installation-token features. |
| `GITHUB_APP_PRIVATE_KEY` | _(none)_ | GitHub App PEM private key. Reserved for future installation-token features. |

## Notes

- **`FRONTEND_URL` and secure cookies** — The `Secure` cookie flag is set based on whether `FRONTEND_URL` starts with `https://`. HTTP deployments (local dev, NodePort without TLS) do not need any special configuration.
- **Helm deployments** — These variables are managed via the Helm `values.yaml` and a ConfigMap/Secret. See [Helm docs](helm.md) for how they map to chart values.
- **Docker Compose** — Pass these via the `.env` file at the repo root. See [Docker docs](docker.md).
