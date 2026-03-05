# Copilot Instructions

## Build and Test

```bash
pnpm install          # install all workspace deps
pnpm dev              # backend :3000, frontend :5173
pnpm build            # build all packages (shared first)
pnpm lint             # lint all packages
pnpm typecheck        # typecheck all packages
```

Backend tests (Vitest):

```bash
cd packages/backend
pnpm test             # run once
pnpm test:watch       # watch mode
pnpm test:coverage    # with coverage
```

## Mandatory Workflow

**After every code change:**

1. Run the relevant test suite (`pnpm test` in `packages/backend`) and fix any failures before finishing.
2. If adding or modifying a feature, add or update the corresponding test in `packages/backend/src/__tests__/`.
3. Update `README.md` if the change affects setup, API routes, environment variables, deployment, or caching behavior.

## Testing Conventions

- Tests live in `packages/backend/src/__tests__/`, mirroring `src/` structure (e.g., `routes/`, `plugins/`).
- Use helpers from `packages/backend/src/__tests__/helpers.ts` to build the Fastify test app.
- Mock external dependencies (GitHub API via `octokit`, JWT, cookies) at the plugin/service boundary—see existing tests in `__tests__/routes/` for patterns.

## Project Conventions

- Shared TypeScript types belong in `packages/shared/src/types.ts`; import them in both backend and frontend via `@gha-dashboard/shared`.
- All backend routes are registered in `packages/backend/src/routes/`; add new routes there and document them in the API Routes table in `README.md`.
- Cache TTLs and logic live in `packages/backend/src/plugins/cache.ts`—update `README.md`'s Caching section if changed.
- Frontend state is managed via Pinia stores in `packages/frontend/src/stores/`.
