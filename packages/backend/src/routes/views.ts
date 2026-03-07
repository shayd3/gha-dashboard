import { FastifyPluginAsync } from "fastify";
import type { CreateViewInput, UpdateViewInput } from "@gha-dashboard/shared";
import { ViewLimitError } from "../services/views.js";

export const viewRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /api/views — list all views for the authenticated user
  fastify.get("/views", async (request, reply) => {
    await fastify.authenticate(request, reply);
    if (reply.sent) return;

    return fastify.viewsRepo.list(request.session.userId);
  });

  // POST /api/views — create a new view
  fastify.post<{ Body: CreateViewInput }>("/views", async (request, reply) => {
    await fastify.authenticate(request, reply);
    if (reply.sent) return;

    const { name, repos, filters } = request.body;
    if (!name || !Array.isArray(repos)) {
      return reply.status(400).send({ error: "name and repos are required" });
    }

    try {
      const view = await fastify.viewsRepo.create(request.session.userId, { name, repos, filters });
      return reply.status(201).send(view);
    } catch (err) {
      const e = err as Error & { code?: string };
      if (e instanceof ViewLimitError) {
        return reply.status(400).send({ error: e.message });
      }
      if (e.code === "23505") {
        return reply.status(409).send({ error: `A view named "${name}" already exists` });
      }
      throw err;
    }
  });

  // PUT /api/views/:id — partial update
  fastify.put<{ Params: { id: string }; Body: UpdateViewInput }>(
    "/views/:id",
    async (request, reply) => {
      await fastify.authenticate(request, reply);
      if (reply.sent) return;

      const view = await fastify.viewsRepo.update(
        request.session.userId,
        request.params.id,
        request.body
      );
      if (!view) return reply.status(404).send({ error: "View not found" });
      return view;
    }
  );

  // DELETE /api/views/:id — delete a view
  fastify.delete<{ Params: { id: string } }>("/views/:id", async (request, reply) => {
    await fastify.authenticate(request, reply);
    if (reply.sent) return;

    const deleted = await fastify.viewsRepo.delete(request.session.userId, request.params.id);
    if (!deleted) return reply.status(404).send({ error: "View not found" });
    return reply.status(204).send();
  });
};
