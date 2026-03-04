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

      const repos: Repository[] = data.map((repo) => ({
        id: repo.id,
        name: repo.name,
        fullName: repo.full_name,
        owner: repo.owner.login,
        private: repo.private,
        defaultBranch: repo.default_branch ?? "main",
        url: repo.html_url,
      }));

      fastify.cache.set(cacheKey, repos, CACHE_TTL);
      return repos;
    }
  );
};
