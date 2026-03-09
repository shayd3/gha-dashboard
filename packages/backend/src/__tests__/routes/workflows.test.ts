import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { buildApp, sessionCookie } from "../helpers.js";
import { workflowRoutes } from "../../routes/workflows.js";
import type { FastifyInstance } from "fastify";

// ------------------------------------------------------------------
// Mock Octokit methods
// ------------------------------------------------------------------
const mockListRepoWorkflows = vi.fn();
const mockListWorkflowRunsForRepo = vi.fn();

const mockOctokit = {
  rest: {
    actions: {
      listRepoWorkflows: mockListRepoWorkflows,
      listWorkflowRunsForRepo: mockListWorkflowRunsForRepo,
    },
  },
};

// ------------------------------------------------------------------
// Fixtures
// ------------------------------------------------------------------
const MOCK_WORKFLOWS = [
  { id: 1, name: "CI", path: ".github/workflows/ci.yml", state: "active" },
  { id: 2, name: "Deploy", path: ".github/workflows/deploy.yml", state: "disabled_manually" },
];

function makeRun(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 1000,
    name: "CI",
    workflow_id: 1,
    head_branch: "main",
    head_sha: "abc123",
    status: "completed",
    conclusion: "success",
    event: "push",
    actor: { login: "alice", avatar_url: "https://github.com/alice.png" },
    run_number: 5,
    run_attempt: 1,
    created_at: "2026-03-01T10:00:00Z",
    updated_at: "2026-03-01T10:05:00Z",
    run_started_at: "2026-03-01T10:00:05Z",
    html_url: "https://github.com/my-org/my-repo/actions/runs/1000",
    ...overrides,
  };
}

// ------------------------------------------------------------------
// Tests
// ------------------------------------------------------------------
describe("Workflow routes", () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    vi.resetAllMocks();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    app = await buildApp(async (a) => {
      await a.register(workflowRoutes, { prefix: "/api" });
    }, mockOctokit as any);
  });

  afterEach(async () => {
    await app.close();
  });

  // ----------------------------------------------------------------
  // GET /api/repos/:owner/:repo/workflows
  // ----------------------------------------------------------------
  describe("GET /api/repos/:owner/:repo/workflows", () => {
    it("returns 401 when unauthenticated", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/repos/my-org/my-repo/workflows",
      });
      expect(res.statusCode).toBe(401);
    });

    it("returns workflows with correct shape", async () => {
      mockListRepoWorkflows.mockResolvedValue({ data: { workflows: MOCK_WORKFLOWS } });

      const cookie = await sessionCookie();
      const res = await app.inject({
        method: "GET",
        url: "/api/repos/my-org/my-repo/workflows",
        headers: { cookie },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json<{ id: number; name: string; state: string; repoFullName: string }[]>();
      expect(body).toHaveLength(2);
      expect(body[0]).toMatchObject({
        id: 1,
        name: "CI",
        path: ".github/workflows/ci.yml",
        state: "active",
        repoFullName: "my-org/my-repo",
      });
    });

    it("caches workflow results on second call", async () => {
      mockListRepoWorkflows.mockResolvedValue({ data: { workflows: MOCK_WORKFLOWS } });

      const cookie = await sessionCookie();
      await app.inject({ method: "GET", url: "/api/repos/my-org/my-repo/workflows", headers: { cookie } });
      await app.inject({ method: "GET", url: "/api/repos/my-org/my-repo/workflows", headers: { cookie } });

      expect(mockListRepoWorkflows).toHaveBeenCalledTimes(1);
    });

    it("returns empty array when GitHub API returns 404", async () => {
      const err = Object.assign(new Error("Not Found"), { status: 404 });
      mockListRepoWorkflows.mockRejectedValue(err);

      const cookie = await sessionCookie();
      const res = await app.inject({
        method: "GET",
        url: "/api/repos/my-org/my-repo/workflows",
        headers: { cookie },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual([]);
    });

    it("returns empty array when GitHub API returns 403", async () => {
      const err = Object.assign(new Error("Forbidden"), { status: 403 });
      mockListRepoWorkflows.mockRejectedValue(err);

      const cookie = await sessionCookie();
      const res = await app.inject({
        method: "GET",
        url: "/api/repos/my-org/my-repo/workflows",
        headers: { cookie },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual([]);
    });

    it("re-throws non-404/403 errors from GitHub API", async () => {
      const err = Object.assign(new Error("Internal Server Error"), { status: 500 });
      mockListRepoWorkflows.mockRejectedValue(err);

      const cookie = await sessionCookie();
      const res = await app.inject({
        method: "GET",
        url: "/api/repos/my-org/my-repo/workflows",
        headers: { cookie },
      });

      expect(res.statusCode).toBe(500);
    });
  });

  // ----------------------------------------------------------------
  // GET /api/repos/:owner/:repo/runs
  // ----------------------------------------------------------------
  describe("GET /api/repos/:owner/:repo/runs", () => {
    it("returns 401 when unauthenticated", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/repos/my-org/my-repo/runs",
      });
      expect(res.statusCode).toBe(401);
    });

    it("returns mapped workflow runs", async () => {
      const run = makeRun();
      mockListWorkflowRunsForRepo.mockResolvedValue({ data: { workflow_runs: [run] } });

      const cookie = await sessionCookie();
      const res = await app.inject({
        method: "GET",
        url: "/api/repos/my-org/my-repo/runs",
        headers: { cookie },
      });

      expect(res.statusCode).toBe(200);
      const [first] = res.json<Record<string, unknown>[]>();
      expect(first).toMatchObject({
        id: 1000,
        name: "CI",
        workflowId: 1,
        repoFullName: "my-org/my-repo",
        headBranch: "main",
        status: "completed",
        conclusion: "success",
        event: "push",
        runNumber: 5,
        runAttempt: 1,
        url: "https://github.com/my-org/my-repo/actions/runs/1000",
      });
    });

    it("calculates duration (ms) for completed runs", async () => {
      const run = makeRun({
        created_at: "2026-03-01T10:00:00Z",
        updated_at: "2026-03-01T10:05:00Z",
        conclusion: "success",
      });
      mockListWorkflowRunsForRepo.mockResolvedValue({ data: { workflow_runs: [run] } });

      const cookie = await sessionCookie();
      const res = await app.inject({
        method: "GET",
        url: "/api/repos/my-org/my-repo/runs",
        headers: { cookie },
      });

      const [first] = res.json<{ duration: number | null }[]>();
      expect(first.duration).toBe(5 * 60 * 1000); // 5 minutes in ms
    });

    it("sets duration to null for in-progress runs", async () => {
      const run = makeRun({ status: "in_progress", conclusion: null });
      mockListWorkflowRunsForRepo.mockResolvedValue({ data: { workflow_runs: [run] } });

      const cookie = await sessionCookie();
      const res = await app.inject({
        method: "GET",
        url: "/api/repos/my-org/my-repo/runs",
        headers: { cookie },
      });

      const [first] = res.json<{ duration: number | null }[]>();
      expect(first.duration).toBeNull();
    });

    it("falls back to run_created_at when run_started_at is absent", async () => {
      const run = makeRun({ run_started_at: undefined });
      mockListWorkflowRunsForRepo.mockResolvedValue({ data: { workflow_runs: [run] } });

      const cookie = await sessionCookie();
      const res = await app.inject({
        method: "GET",
        url: "/api/repos/my-org/my-repo/runs",
        headers: { cookie },
      });

      const [first] = res.json<{ runStartedAt: string; createdAt: string }[]>();
      expect(first.runStartedAt).toBe(first.createdAt);
    });

    it("passes branch, status, and actor filters to the GitHub API", async () => {
      mockListWorkflowRunsForRepo.mockResolvedValue({ data: { workflow_runs: [] } });

      const cookie = await sessionCookie();
      await app.inject({
        method: "GET",
        url: "/api/repos/my-org/my-repo/runs?branch=feature%2Ftest&status=completed&per_page=5&actor=alice",
        headers: { cookie },
      });

      expect(mockListWorkflowRunsForRepo).toHaveBeenCalledWith(
        expect.objectContaining({
          branch: "feature/test",
          status: "completed",
          per_page: 5,
          actor: "alice",
        })
      );
    });

    it("returns empty array when GitHub API returns 404", async () => {
      const err = Object.assign(new Error("Not Found"), { status: 404 });
      mockListWorkflowRunsForRepo.mockRejectedValue(err);

      const cookie = await sessionCookie();
      const res = await app.inject({
        method: "GET",
        url: "/api/repos/my-org/my-repo/runs",
        headers: { cookie },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual([]);
    });

    it("returns empty array when GitHub API returns 403", async () => {
      const err = Object.assign(new Error("Forbidden"), { status: 403 });
      mockListWorkflowRunsForRepo.mockRejectedValue(err);

      const cookie = await sessionCookie();
      const res = await app.inject({
        method: "GET",
        url: "/api/repos/my-org/my-repo/runs",
        headers: { cookie },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual([]);
    });

    it("re-throws non-404/403 errors from GitHub API", async () => {
      const err = Object.assign(new Error("Internal Server Error"), { status: 500 });
      mockListWorkflowRunsForRepo.mockRejectedValue(err);

      const cookie = await sessionCookie();
      const res = await app.inject({
        method: "GET",
        url: "/api/repos/my-org/my-repo/runs",
        headers: { cookie },
      });

      expect(res.statusCode).toBe(500);
    });
  });

  // ----------------------------------------------------------------
  // GET /api/runs (aggregated)
  // ----------------------------------------------------------------
  describe("GET /api/runs", () => {
    it("returns 401 when unauthenticated", async () => {
      const res = await app.inject({ method: "GET", url: "/api/runs?repos=my-org/my-repo" });
      expect(res.statusCode).toBe(401);
    });

    it("returns 400 when repos param is missing", async () => {
      const cookie = await sessionCookie();
      const res = await app.inject({
        method: "GET",
        url: "/api/runs",
        headers: { cookie },
      });
      expect(res.statusCode).toBe(400);
      expect(res.json()).toMatchObject({ error: "repos query parameter is required" });
    });

    it("returns aggregated runs sorted by newest first", async () => {
      const oldRun = makeRun({ id: 1, created_at: "2026-03-01T08:00:00Z", updated_at: "2026-03-01T08:05:00Z" });
      const newRun = makeRun({ id: 2, created_at: "2026-03-02T10:00:00Z", updated_at: "2026-03-02T10:05:00Z" });

      mockListWorkflowRunsForRepo
        .mockResolvedValueOnce({ data: { workflow_runs: [oldRun] } })   // my-org/repo-a
        .mockResolvedValueOnce({ data: { workflow_runs: [newRun] } });  // my-org/repo-b

      const cookie = await sessionCookie();
      const res = await app.inject({
        method: "GET",
        url: "/api/runs?repos=my-org/repo-a,my-org/repo-b",
        headers: { cookie },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json<{ id: number }[]>();
      expect(body[0].id).toBe(2); // newer run first
      expect(body[1].id).toBe(1);
    });

    it("skips repos with malformed owner/name and continues", async () => {
      mockListWorkflowRunsForRepo.mockResolvedValue({ data: { workflow_runs: [makeRun()] } });

      const cookie = await sessionCookie();
      const res = await app.inject({
        method: "GET",
        url: "/api/runs?repos=my-org/my-repo,bad-entry",
        headers: { cookie },
      });

      expect(res.statusCode).toBe(200);
      // Only the valid repo contributes runs
      expect(mockListWorkflowRunsForRepo).toHaveBeenCalledTimes(1);
    });

    it("continues when a repo fetch fails (returns empty for that repo)", async () => {
      mockListWorkflowRunsForRepo
        .mockRejectedValueOnce(new Error("Not found"))
        .mockResolvedValueOnce({ data: { workflow_runs: [makeRun({ id: 999 })] } });

      const cookie = await sessionCookie();
      const res = await app.inject({
        method: "GET",
        url: "/api/runs?repos=my-org/bad-repo,my-org/good-repo",
        headers: { cookie },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json<{ id: number }[]>();
      expect(body).toHaveLength(1);
      expect(body[0].id).toBe(999);
    });

    it("fetches upstream runs with actor filter when upstream_repos is provided", async () => {
      const forkRun = makeRun({ id: 100, name: "Fork CI" });
      const upstreamRun = makeRun({ id: 200, name: "Upstream CI", created_at: "2026-03-03T10:00:00Z", updated_at: "2026-03-03T10:05:00Z" });

      mockListWorkflowRunsForRepo
        .mockResolvedValueOnce({ data: { workflow_runs: [forkRun] } })      // fork repo
        .mockResolvedValueOnce({ data: { workflow_runs: [upstreamRun] } }); // upstream repo

      const cookie = await sessionCookie();
      const res = await app.inject({
        method: "GET",
        url: "/api/runs?repos=testuser/my-fork&upstream_repos=upstream-org/my-fork:testuser:testuser/my-fork",
        headers: { cookie },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json<{ id: number; isUpstreamRun?: boolean; forkRepoFullName?: string }[]>();
      expect(body).toHaveLength(2);

      // Upstream run should be first (newer)
      const upstream = body.find((r) => r.id === 200);
      expect(upstream?.isUpstreamRun).toBe(true);
      expect(upstream?.forkRepoFullName).toBe("testuser/my-fork");

      // Fork run should not be marked as upstream
      const fork = body.find((r) => r.id === 100);
      expect(fork?.isUpstreamRun).toBeUndefined();
    });

    it("passes actor filter to GitHub API for upstream repos", async () => {
      mockListWorkflowRunsForRepo
        .mockResolvedValue({ data: { workflow_runs: [] } });

      const cookie = await sessionCookie();
      await app.inject({
        method: "GET",
        url: "/api/runs?repos=testuser/my-fork&upstream_repos=upstream-org/my-fork:alice:testuser/my-fork",
        headers: { cookie },
      });

      // Second call should be for the upstream repo with actor filter
      expect(mockListWorkflowRunsForRepo).toHaveBeenCalledTimes(2);
      expect(mockListWorkflowRunsForRepo).toHaveBeenCalledWith(
        expect.objectContaining({
          owner: "upstream-org",
          repo: "my-fork",
          actor: "alice",
        })
      );
    });

    it("continues when upstream repo fetch fails", async () => {
      const forkRun = makeRun({ id: 100 });
      mockListWorkflowRunsForRepo
        .mockResolvedValueOnce({ data: { workflow_runs: [forkRun] } })  // fork repo
        .mockRejectedValueOnce(new Error("Not found"));                 // upstream repo

      const cookie = await sessionCookie();
      const res = await app.inject({
        method: "GET",
        url: "/api/runs?repos=testuser/my-fork&upstream_repos=upstream-org/my-fork:testuser:testuser/my-fork",
        headers: { cookie },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json<{ id: number }[]>();
      expect(body).toHaveLength(1);
      expect(body[0].id).toBe(100);
    });

    it("skips malformed upstream_repos entries", async () => {
      mockListWorkflowRunsForRepo
        .mockResolvedValue({ data: { workflow_runs: [makeRun()] } });

      const cookie = await sessionCookie();
      const res = await app.inject({
        method: "GET",
        url: "/api/runs?repos=my-org/my-repo&upstream_repos=bad-entry",
        headers: { cookie },
      });

      expect(res.statusCode).toBe(200);
      // Only the regular repo call, not the malformed upstream
      expect(mockListWorkflowRunsForRepo).toHaveBeenCalledTimes(1);
    });

    it("annotates cached upstream runs with the correct forkRepoFullName per request", async () => {
      const regularRun = makeRun({ id: 100, name: "Fork CI" });
      const upstreamRun = makeRun({ id: 300, name: "Upstream CI" });

      // First request fetches user/fork-a (direct) and upstream-org/shared-upstream (upstream).
      // Second request fetches user/fork-b (direct) but hits cache for the upstream.
      mockListWorkflowRunsForRepo
        .mockResolvedValueOnce({ data: { workflow_runs: [regularRun] } }) // user/fork-a direct
        .mockResolvedValueOnce({ data: { workflow_runs: [upstreamRun] } }) // upstream (first fetch)
        .mockResolvedValue({ data: { workflow_runs: [regularRun] } }); // user/fork-b direct

      const cookie = await sessionCookie();

      // First request: fork-a -> upstream-org/shared-upstream
      const res1 = await app.inject({
        method: "GET",
        url: "/api/runs?repos=user/fork-a&upstream_repos=upstream-org/shared-upstream:alice:user/fork-a",
        headers: { cookie },
      });
      expect(res1.statusCode).toBe(200);
      const body1 = res1.json<{ id: number; isUpstreamRun?: boolean; forkRepoFullName?: string }[]>();
      const upstreamResult1 = body1.find((r) => r.isUpstreamRun);
      expect(upstreamResult1?.forkRepoFullName).toBe("user/fork-a");

      // Second request: fork-b -> same upstream (upstream served from cache)
      const res2 = await app.inject({
        method: "GET",
        url: "/api/runs?repos=user/fork-b&upstream_repos=upstream-org/shared-upstream:alice:user/fork-b",
        headers: { cookie },
      });
      expect(res2.statusCode).toBe(200);
      const body2 = res2.json<{ id: number; isUpstreamRun?: boolean; forkRepoFullName?: string }[]>();
      const upstreamResult2 = body2.find((r) => r.isUpstreamRun);
      // Must be annotated with fork-b, not the previously cached fork-a
      expect(upstreamResult2?.forkRepoFullName).toBe("user/fork-b");

      // GitHub API called 3 times: fork-a direct, upstream (once), fork-b direct
      // The upstream call is NOT repeated for fork-b because of the shared cache
      expect(mockListWorkflowRunsForRepo).toHaveBeenCalledTimes(3);
    });
  });
});
