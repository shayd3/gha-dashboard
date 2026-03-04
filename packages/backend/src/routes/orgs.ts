import { FastifyPluginAsync } from "fastify";
import type { Organization } from "@gha-dashboard/shared";

const CACHE_TTL = 300; // 5 minutes

export const orgRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get("/orgs", async (request, reply) => {
    await fastify.authenticate(request, reply);
    if (reply.sent) return;

    const cacheKey = `${request.session.userId}:orgs`;
    const cached = fastify.cache.get<Organization[]>(cacheKey);
    if (cached) return cached;

    const { data } =
      await request.octokit.rest.orgs.listForAuthenticatedUser({
        per_page: 100,
      });

    const orgs: Organization[] = data.map((org) => ({
      id: org.id,
      login: org.login,
      avatarUrl: org.avatar_url,
      description: org.description ?? null,
    }));

    fastify.cache.set(cacheKey, orgs, CACHE_TTL);
    return orgs;
  });
};
