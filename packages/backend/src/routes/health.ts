import { FastifyPluginAsync } from "fastify";

export const healthRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get("/api/health", async () => {
    return { status: "ok", timestamp: new Date().toISOString() };
  });
};
