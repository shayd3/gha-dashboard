# Docker

## Running with Docker Compose

```bash
cp .env.example .env  # fill in required values
docker compose up --build
```

- Frontend: [http://localhost](http://localhost) (nginx on port 80)
- Backend: [http://localhost:3000](http://localhost:3000)

The `db` service runs PostgreSQL 16. The backend waits for `pg_isready` before starting.

## Services

| Service | Description |
|---------|-------------|
| `frontend` | nginx serving the Vue SPA, proxies `/api` to the backend |
| `backend` | Fastify API |
| `db` | PostgreSQL 16 (no external port exposed) |

## Stopping

```bash
docker compose down
```

> **Warning:** `docker compose down -v` will delete the `pgdata` volume and all stored views.

## Running Without the Database

Leave `DATABASE_URL` unset in your `.env`. The backend starts normally, logs a warning, and stores views in-memory only.
