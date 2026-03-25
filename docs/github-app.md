# GitHub App Setup

GHA Dashboard authenticates users via a GitHub App using user-to-server OAuth. You need to create one before running the app.

## Creating the App

1. Go to **Settings → Developer settings → GitHub Apps → New GitHub App**
2. Fill in the fields:

   | Field | Value |
   |-------|-------|
   | GitHub App name | Anything (e.g. `gha-dashboard-local`) |
   | Homepage URL | `http://localhost:5173` (or your deployed URL) |
   | Callback URL | `http://localhost:5173/api/auth/callback` (see [Callback URL](#callback-url)) |
   | Webhook | Uncheck "Active" — not needed |

3. Under **Permissions**, set:

   | Permission | Level |
   |-----------|-------|
   | Repository → Actions | Read-only |
   | Repository → Metadata | Read-only (auto-selected) |
   | Organization → Members | Read-only |

4. Set **"Where can this GitHub App be installed?"** to **Any account** if you want to monitor orgs you don't own.

5. Click **Create GitHub App**.

6. On the app page, note the **Client ID** and generate a **Client secret** — you'll need both for your `.env`.

7. **Install the app** on every organization or account whose repos you want to monitor (Settings → Install App).

> **Note:** Users will only see repos at the intersection of "repos they personally have access to" and "repos where the GitHub App is installed."

## Callback URL

The callback URL must exactly match what the backend sends as `redirect_uri`. It is constructed as:

```
{FRONTEND_URL}/api/auth/callback
```

| Deployment | FRONTEND_URL | Callback URL to register |
|-----------|--------------|--------------------------|
| Local dev | `http://localhost:5173` | `http://localhost:5173/api/auth/callback` |
| Docker Compose | `http://localhost` | `http://localhost/api/auth/callback` |
| Helm + Ingress | `https://gha-dashboard.example.com` | `https://gha-dashboard.example.com/api/auth/callback` |
| Helm + NodePort | `http://your-node:31515` | `http://your-node:31515/api/auth/callback` |

You can register multiple callback URLs in the GitHub App settings using the **Add Callback URL** button — useful if you run the app in multiple environments with the same App.

## Token Expiration

User-to-server token expiration is enabled by default for new GitHub Apps. GHA Dashboard handles refresh automatically — no action required.

## GitHub Enterprise

Set `GITHUB_API_URL` to your GHE endpoint (e.g. `https://github.yourcompany.com/api/v3`). GitHub EMU (Enterprise Managed Users) on github.com is also supported.
