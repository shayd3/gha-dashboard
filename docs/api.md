# API Reference

All routes are prefixed with `/api`. Authentication is via an `HttpOnly` session cookie set after OAuth login.

## Auth

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/auth/login` | — | Redirect to GitHub OAuth |
| `GET` | `/api/auth/callback` | — | OAuth callback — sets session cookie and redirects to frontend |
| `GET` | `/api/auth/me` | Required | Returns current user info |
| `POST` | `/api/auth/logout` | — | Clears session cookie |

### `GET /api/auth/me` Response

```json
{
  "id": 12345,
  "login": "octocat",
  "avatarUrl": "https://avatars.githubusercontent.com/u/12345",
  "name": "The Octocat"
}
```

## Organizations & Repos

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/orgs` | List organizations the authenticated user belongs to |
| `GET` | `/api/orgs/:org/repos` | List repos in an organization |

## Workflows & Runs

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/repos/:owner/:repo/workflows` | List workflows for a repo |
| `GET` | `/api/repos/:owner/:repo/runs` | List runs for a repo |
| `GET` | `/api/runs` | Aggregated runs across multiple repos (see below) |

### `GET /api/runs` Query Parameters

| Parameter | Description |
|-----------|-------------|
| `repos` | Comma-separated list of `owner/repo` slugs |
| `upstream_repos` | Comma-separated list of `upstream/repo:actor:fork/repo` triples for upstream fork run fetching |

## Views

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/views` | List saved views for the authenticated user |
| `POST` | `/api/views` | Create a view — 201 on success, 409 on duplicate name, 400 if over 20-view limit |
| `PUT` | `/api/views/:id` | Update a view (name, repos, filters, position) |
| `DELETE` | `/api/views/:id` | Delete a view — 204 on success |

### View Body

```json
{
  "name": "My View",
  "repos": ["org/repo1", "org/repo2"],
  "filters": {
    "status": "failure",
    "branch": "main"
  }
}
```

## Health

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/health` | Returns `{"status":"ok","timestamp":"..."}` — used for liveness/readiness probes |

## Caching

Responses are cached in-memory per user (keyed by `userId:endpoint`):

| Endpoint | TTL |
|----------|-----|
| Orgs / repos | 5 minutes |
| Workflow runs | 60 seconds |
| Upstream fork runs | 60 seconds |
