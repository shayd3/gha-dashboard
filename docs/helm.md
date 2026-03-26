# Helm Deployment

## Prerequisites

- Kubernetes cluster with an nginx ingress controller (for ingress deployments)
- Helm 3.x
- A configured [GitHub App](github-app.md)

## Install from OCI Registry

```bash
helm registry login ghcr.io
helm install gha-dashboard oci://ghcr.io/shayd3/charts/gha-dashboard \
  --version 1.0.2 \
  --namespace gha-dashboard --create-namespace \
  --set github.appClientId=YOUR_CLIENT_ID \
  --set github.appClientSecret=YOUR_CLIENT_SECRET \
  --set jwt.secret=YOUR_JWT_SECRET \
  --set ingress.enabled=true \
  --set ingress.host=gha-dashboard.example.com
```

## Install from Source

```bash
helm install gha-dashboard ./deploy/helm/gha-dashboard \
  --namespace gha-dashboard --create-namespace \
  --set github.appClientId=YOUR_CLIENT_ID \
  --set github.appClientSecret=YOUR_CLIENT_SECRET \
  --set jwt.secret=YOUR_JWT_SECRET \
  --set ingress.enabled=true \
  --set ingress.host=gha-dashboard.example.com
```

## Deploying Without an Ingress (NodePort)

When `ingress.enabled` is `false`, set `frontendUrl` explicitly so the OAuth redirect URI and CORS origin are correct.

To pin stable ports (recommended — avoids random port reassignment on Service recreate):

```bash
helm install gha-dashboard oci://ghcr.io/shayd3/charts/gha-dashboard \
  --version 1.0.2 \
  --namespace gha-dashboard --create-namespace \
  --set github.appClientId=YOUR_CLIENT_ID \
  --set github.appClientSecret=YOUR_CLIENT_SECRET \
  --set jwt.secret=YOUR_JWT_SECRET \
  --set frontend.service.type=NodePort \
  --set frontend.service.nodePort=31515 \
  --set backend.service.type=NodePort \
  --set backend.service.nodePort=31000 \
  --set frontendUrl=http://YOUR_NODE:31515
```

Register `http://YOUR_NODE:31515/api/auth/callback` as the callback URL in your GitHub App (substitute the port you chose for `frontend.service.nodePort`).

If you omit `nodePort`, Kubernetes auto-assigns a port from the `30000–32767` range. Find the assigned port with:

```bash
kubectl get svc gha-dashboard-frontend -n gha-dashboard
```

Then register `http://YOUR_NODE:<assigned-port>/api/auth/callback` as the callback URL.

## With PostgreSQL

```bash
--set database.url='postgresql://user:pass@host:5432/gha_dashboard'
```

`database.url` is stored in a Kubernetes Secret. If omitted, views are stored in-memory only.

## TLS

```bash
--set ingress.tls.enabled=true \
--set ingress.tls.secretName=gha-dashboard-tls \
--set ingress.host=gha-dashboard.example.com
```

Provision the TLS secret separately (e.g. via cert-manager).

## Key Values Reference

| Value | Default | Description |
|-------|---------|-------------|
| `frontend.service.type` | `ClusterIP` | Service type for the frontend (`ClusterIP`, `NodePort`) |
| `frontend.service.nodePort` | _(unset)_ | Pin a specific NodePort for the frontend (30000–32767); auto-assigned if omitted |
| `backend.service.type` | `ClusterIP` | Service type for the backend (`ClusterIP`, `NodePort`) |
| `backend.service.nodePort` | _(unset)_ | Pin a specific NodePort for the backend (30000–32767); auto-assigned if omitted |
| `frontendUrl` | _(derived from ingress host)_ | Explicit URL for OAuth redirect and CORS. Required when ingress is disabled. |
| `ingress.enabled` | `false` | Enable nginx Ingress |
| `ingress.host` | `gha-dashboard.example.com` | Ingress hostname |
| `ingress.tls.enabled` | `false` | Enable TLS on the Ingress |
| `github.appClientId` | `""` | GitHub App client ID |
| `github.appClientSecret` | `""` | GitHub App client secret |
| `jwt.secret` | `""` | JWT signing secret |
| `database.url` | `""` | PostgreSQL connection string |
| `github.apiUrl` | `https://api.github.com` | GitHub API URL (override for GHE) |

See [`values.yaml`](../deploy/helm/gha-dashboard/values.yaml) for the full list including resource limits and replica counts.

## Upgrading

```bash
helm upgrade gha-dashboard oci://ghcr.io/shayd3/charts/gha-dashboard \
  --version 1.0.2 \
  --namespace gha-dashboard \
  --reuse-values
```

## Validating a Local Chart

```bash
helm lint deploy/helm/gha-dashboard/
helm template gha-dashboard deploy/helm/gha-dashboard/ --set github.appClientId=test
```
