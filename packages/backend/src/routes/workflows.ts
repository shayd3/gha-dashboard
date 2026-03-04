import { FastifyPluginAsync } from "fastify";
import type { Workflow, WorkflowRun } from "@gha-dashboard/shared";

const WORKFLOW_CACHE_TTL = 300; // 5 minutes
const RUNS_CACHE_TTL = 60; // 1 minute

function mapRun(run: Record<string, unknown>, repoFullName: string): WorkflowRun {
  const r = run as {
    id: number;
    name: string | null;
    workflow_id: number;
    head_branch: string | null;
    head_sha: string;
    status: string | null;
    conclusion: string | null;
    event: string;
    actor: { login: string; avatar_url: string } | null;
    run_number: number;
    run_attempt: number | undefined;
    created_at: string;
    updated_at: string;
    run_started_at: string | undefined;
    html_url: string;
  };

  const createdAt = new Date(r.created_at).getTime();
  const updatedAt = new Date(r.updated_at).getTime();
  const duration = r.conclusion ? updatedAt - createdAt : null;

  return {
    id: r.id,
    name: r.name || "Unknown",
    workflowId: r.workflow_id,
    repoFullName,
    headBranch: r.head_branch || "",
    headSha: r.head_sha,
    status: (r.status as WorkflowRun["status"]) || "queued",
    conclusion: (r.conclusion as WorkflowRun["conclusion"]) ?? null,
    event: r.event,
    actor: {
      login: r.actor?.login || "unknown",
      avatarUrl: r.actor?.avatar_url || "",
    },
    runNumber: r.run_number,
    runAttempt: r.run_attempt ?? 1,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    runStartedAt: r.run_started_at || r.created_at,
    url: r.html_url,
    duration,
  };
}

export const workflowRoutes: FastifyPluginAsync = async (fastify) => {
  // List workflows for a repo
  fastify.get<{ Params: { owner: string; repo: string } }>(
    "/repos/:owner/:repo/workflows",
    async (request, reply) => {
      await fastify.authenticate(request, reply);
      if (reply.sent) return;

      const { owner, repo } = request.params;
      const cacheKey = `${request.session.userId}:workflows:${owner}/${repo}`;
      const cached = fastify.cache.get<Workflow[]>(cacheKey);
      if (cached) return cached;

      const { data } = await request.octokit.rest.actions.listRepoWorkflows({
        owner,
        repo,
        per_page: 100,
      });

      const workflows: Workflow[] = data.workflows.map((w) => ({
        id: w.id,
        name: w.name,
        path: w.path,
        state: w.state as Workflow["state"],
        repoFullName: `${owner}/${repo}`,
      }));

      fastify.cache.set(cacheKey, workflows, WORKFLOW_CACHE_TTL);
      return workflows;
    }
  );

  // List runs for a repo
  fastify.get<{
    Params: { owner: string; repo: string };
    Querystring: { branch?: string; status?: string; per_page?: string };
  }>("/repos/:owner/:repo/runs", async (request, reply) => {
    await fastify.authenticate(request, reply);
    if (reply.sent) return;

    const { owner, repo } = request.params;
    const { branch, status, per_page } = request.query;
    const perPage = parseInt(per_page || "30", 10);

    const cacheKey = `${request.session.userId}:runs:${owner}/${repo}:${branch || ""}:${status || ""}:${perPage}`;
    const cached = fastify.cache.get<WorkflowRun[]>(cacheKey);
    if (cached) return cached;

    const { data } = await request.octokit.rest.actions.listWorkflowRunsForRepo(
      {
        owner,
        repo,
        per_page: perPage,
        ...(branch ? { branch } : {}),
        ...(status ? { status: status as "completed" | "queued" | "in_progress" } : {}),
      }
    );

    const runs = data.workflow_runs.map((r) =>
      mapRun(r as unknown as Record<string, unknown>, `${owner}/${repo}`)
    );

    fastify.cache.set(cacheKey, runs, RUNS_CACHE_TTL);
    return runs;
  });

  // Aggregated runs across multiple repos
  fastify.get<{ Querystring: { repos: string; per_page?: string } }>(
    "/runs",
    async (request, reply) => {
      await fastify.authenticate(request, reply);
      if (reply.sent) return;

      const { repos, per_page } = request.query;
      if (!repos) {
        reply.status(400).send({ error: "repos query parameter is required" });
        return;
      }

      const perPage = parseInt(per_page || "20", 10);
      const repoList = repos.split(",").map((r) => r.trim());

      const results = await Promise.all(
        repoList.map(async (repoFullName) => {
          const [owner, repo] = repoFullName.split("/");
          if (!owner || !repo) return [];

          const cacheKey = `${request.session.userId}:runs:${repoFullName}:agg:${perPage}`;
          const cached = fastify.cache.get<WorkflowRun[]>(cacheKey);
          if (cached) return cached;

          try {
            const { data } =
              await request.octokit.rest.actions.listWorkflowRunsForRepo({
                owner,
                repo,
                per_page: perPage,
              });

            const runs = data.workflow_runs.map((r) =>
              mapRun(r as unknown as Record<string, unknown>, repoFullName)
            );
            fastify.cache.set(cacheKey, runs, RUNS_CACHE_TTL);
            return runs;
          } catch (err) {
            fastify.log.warn(
              { err, repo: repoFullName },
              "Failed to fetch runs"
            );
            return [];
          }
        })
      );

      const allRuns = results
        .flat()
        .sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );

      return allRuns;
    }
  );
};
