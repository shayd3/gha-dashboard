import { FastifyPluginAsync } from "fastify";
import type { Workflow, WorkflowRun } from "@gha-dashboard/shared";

const WORKFLOW_CACHE_TTL = 300; // 5 minutes
const RUNS_CACHE_TTL = 60; // 1 minute

function mapRun(
  run: Record<string, unknown>,
  repoFullName: string,
  options?: { isUpstreamRun?: boolean; forkRepoFullName?: string }
): WorkflowRun {
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
    ...(options?.isUpstreamRun ? { isUpstreamRun: true } : {}),
    ...(options?.forkRepoFullName ? { forkRepoFullName: options.forkRepoFullName } : {}),
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

      try {
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
      } catch (err) {
        const status = (err as { status?: number }).status;
        if (status === 404 || status === 403) {
          fastify.log.warn(
            { err, repo: `${owner}/${repo}` },
            "Cannot access workflows — the GitHub App may not be installed on this repo or Actions may be disabled"
          );
          return [];
        }
        throw err;
      }
    }
  );

  // List runs for a repo
  fastify.get<{
    Params: { owner: string; repo: string };
    Querystring: { branch?: string; status?: string; per_page?: string; actor?: string };
  }>("/repos/:owner/:repo/runs", async (request, reply) => {
    await fastify.authenticate(request, reply);
    if (reply.sent) return;

    const { owner, repo } = request.params;
    const { branch, status, per_page, actor } = request.query;
    const perPage = parseInt(per_page || "30", 10);

    const cacheKey = `${request.session.userId}:runs:${owner}/${repo}:${branch || ""}:${status || ""}:${perPage}:${actor || ""}`;
    const cached = fastify.cache.get<WorkflowRun[]>(cacheKey);
    if (cached) return cached;

    try {
      const { data } = await request.octokit.rest.actions.listWorkflowRunsForRepo(
        {
          owner,
          repo,
          per_page: perPage,
          ...(branch ? { branch } : {}),
          ...(status ? { status: status as "completed" | "queued" | "in_progress" } : {}),
          ...(actor ? { actor } : {}),
        }
      );

      const runs = data.workflow_runs.map((r) =>
        mapRun(r as unknown as Record<string, unknown>, `${owner}/${repo}`)
      );

      fastify.cache.set(cacheKey, runs, RUNS_CACHE_TTL);
      return runs;
    } catch (err) {
      const status = (err as { status?: number }).status;
      if (status === 404 || status === 403) {
        fastify.log.warn(
          { err, repo: `${owner}/${repo}` },
          "Cannot access runs — the GitHub App may not be installed on this repo or Actions may be disabled"
        );
        return [];
      }
      throw err;
    }
  });

  // Aggregated runs across multiple repos (with optional upstream fork support)
  fastify.get<{ Querystring: { repos: string; per_page?: string; upstream_repos?: string } }>(
    "/runs",
    async (request, reply) => {
      await fastify.authenticate(request, reply);
      if (reply.sent) return;

      const { repos, per_page, upstream_repos } = request.query;
      if (!repos) {
        reply.status(400).send({ error: "repos query parameter is required" });
        return;
      }

      const perPage = parseInt(per_page || "20", 10);
      const repoList = repos.split(",").map((r) => r.trim());

      // Fetch runs for directly-selected repos
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

      // Fetch upstream runs for fork repos (filtered by actor)
      let upstreamResults: WorkflowRun[][] = [];
      if (upstream_repos) {
        const upstreamEntries = upstream_repos.split(",").map((e) => e.trim());
        upstreamResults = await Promise.all(
          upstreamEntries.map(async (entry) => {
            // Format: upstreamOwner/upstreamRepo:actor:forkOwner/forkRepo
            const parts = entry.split(":");
            if (parts.length < 3) return [];
            const [upstreamFullName, actor, forkFullName] = parts;
            const [owner, repo] = upstreamFullName.split("/");
            if (!owner || !repo || !actor) return [];

            // Cache un-annotated runs (no forkRepoFullName) so the same entry
            // can be reused when multiple forks share the same upstream + actor.
            const cacheKey = `${request.session.userId}:runs:${upstreamFullName}:upstream:${actor}:${perPage}`;
            let baseRuns = fastify.cache.get<WorkflowRun[]>(cacheKey);

            if (!baseRuns) {
              try {
                const { data } =
                  await request.octokit.rest.actions.listWorkflowRunsForRepo({
                    owner,
                    repo,
                    per_page: perPage,
                    actor,
                  });

                baseRuns = data.workflow_runs.map((r) =>
                  mapRun(
                    r as unknown as Record<string, unknown>,
                    upstreamFullName,
                    { isUpstreamRun: true }
                  )
                );
                fastify.cache.set(cacheKey, baseRuns, RUNS_CACHE_TTL);
              } catch (err) {
                fastify.log.warn(
                  { err, upstream: upstreamFullName, actor },
                  "Failed to fetch upstream runs"
                );
                return [];
              }
            }

            // Annotate with the requesting fork's name (not stored in cache)
            return baseRuns.map((r) => ({ ...r, forkRepoFullName: forkFullName }));
          })
        );
      }

      const allRuns = [...results, ...upstreamResults]
        .flat()
        .sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );

      return allRuns;
    }
  );
};
