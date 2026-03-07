import { FastifyPluginAsync } from "fastify";
import fp from "fastify-plugin";
import pg from "pg";
import { MemoryViewsRepo, PgViewsRepo, type ViewsRepo } from "../services/views.js";

declare module "fastify" {
  interface FastifyInstance {
    viewsRepo: ViewsRepo;
  }
}

const MIGRATION_SQL = `
  CREATE TABLE IF NOT EXISTS views (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    repos JSONB NOT NULL,
    filters JSONB,
    position INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, name)
  );
  CREATE INDEX IF NOT EXISTS idx_views_user_id ON views (user_id);
`;

const plugin: FastifyPluginAsync = async (fastify) => {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    fastify.log.warn(
      "DATABASE_URL is not set — views will be stored in-memory only and will NOT persist across restarts"
    );
    fastify.decorate("viewsRepo", new MemoryViewsRepo());
    return;
  }

  const pool = new pg.Pool({ connectionString: databaseUrl });

  // Run startup migration
  await pool.query(MIGRATION_SQL);

  fastify.decorate("viewsRepo", new PgViewsRepo(pool));

  fastify.addHook("onClose", async () => {
    await pool.end();
  });
};

export const dbPlugin = fp(plugin, { name: "db" });
