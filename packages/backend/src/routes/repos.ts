import { FastifyPluginAsync } from "fastify";
import type { Repository } from "@gha-dashboard/shared";

const CACHE_TTL = 300; // 5 minutes

export const repoRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get<{ Params: { org: string }; Querystring: { page?: string; per_page?: string } }>(
    "/orgs/:org/repos",
    async (request, reply) => {
      await fastify.authenticate(request, reply);
      if (reply.sent) return;

      const { org } = request.params;
      const page = parseInt(request.query.page || "1", 10);
      const perPage = parseInt(request.query.per_page || "100", 10);

      const cacheKey = `${request.session.userId}:repos:${org}:${page}:${perPage}`;
      const cached = fastify.cache.get<Repository[]>(cacheKey);
      if (cached) return cached;

      // If the "org" is the authenticated user, list their own repos instead
      const isUser = org === request.session.login;
      const { data } = isUser
        ? await request.octokit.rest.repos.listForAuthenticatedUser({
            per_page: perPage,
            page,
            sort: "updated",
            direction: "desc",
          })
        : await request.octokit.rest.repos.listForOrg({
            org,
            per_page: perPage,
            page,
            sort: "updated",
            direction: "desc",
          });

      // Filter to only repos owned by this org/user — repos from other orgs
      // will appear under their own org section in the sidebar
      const ownedData = data.filter((repo) => repo.owner.login === org);

      const repos: Repository[] = ownedData.map((repo) => {
        const parentRaw = (repo as Record<string, unknown>).parent as {
          full_name: string;
          owner: { login: string };
          name: string;
          default_branch: string;
        } | undefined;

        const mapped: Repository = {
          id: repo.id,
          name: repo.name,
          fullName: repo.full_name,
          owner: repo.owner.login,
          private: repo.private,
          defaultBranch: repo.default_branch ?? "main",
          url: repo.html_url,
          isFork: !!repo.fork,
        };

        if (parentRaw) {
          mapped.parent = {
            fullName: parentRaw.full_name,
            owner: parentRaw.owner.login,
            name: parentRaw.name,
            defaultBranch: parentRaw.default_branch ?? "main",
          };
        }

        return mapped;
      });

      // For forks missing parent details, fetch individual repo info
      const forksWithoutParent = repos.filter((r) => r.isFork && !r.parent);
      if (forksWithoutParent.length) {
        await Promise.all(
          forksWithoutParent.map(async (repo) => {
            try {
              const { data: full } = await request.octokit.rest.repos.get({
                owner: repo.owner,
                repo: repo.name,
              });
              const p = (full as Record<string, unknown>).parent as {
                full_name: string;
                owner: { login: string };
                name: string;
                default_branch: string;
              } | undefined;
              if (p) {
                repo.parent = {
                  fullName: p.full_name,
                  owner: p.owner.login,
                  name: p.name,
                  defaultBranch: p.default_branch ?? "main",
                };
              }
            } catch {
              // If we can't fetch parent details, skip — the fork just won't show upstream runs
            }
          })
        );
      }

      fastify.cache.set(cacheKey, repos, CACHE_TTL);
      return repos;
    }
  );
};
