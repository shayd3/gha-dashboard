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

    // Fetch user info and orgs in parallel
    const [{ data: user }, { data }] = await Promise.all([
      request.octokit.rest.users.getAuthenticated(),
      request.octokit.rest.orgs.listForAuthenticatedUser({ per_page: 100 }),
    ]);

    const userEntry: Organization = {
      id: user.id,
      login: user.login,
      avatarUrl: user.avatar_url,
      description: "Your personal repositories",
    };

    const orgs: Organization[] = [
      userEntry,
      ...data.map((org) => ({
        id: org.id,
        login: org.login,
        avatarUrl: org.avatar_url,
        description: org.description ?? null,
      })),
    ];

    fastify.cache.set(cacheKey, orgs, CACHE_TTL);
    return orgs;
  });
};
