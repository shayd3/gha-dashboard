import Fastify from "fastify";
import cors from "@fastify/cors";
import cookie from "@fastify/cookie";
import { authPlugin } from "./plugins/auth.js";
import { cachePlugin } from "./plugins/cache.js";
import { authRoutes } from "./routes/auth.js";
import { orgRoutes } from "./routes/orgs.js";
import { repoRoutes } from "./routes/repos.js";
import { workflowRoutes } from "./routes/workflows.js";
import { healthRoutes } from "./routes/health.js";

const PORT = parseInt(process.env.PORT || "3000", 10);
const HOST = process.env.HOST || "0.0.0.0";

const app = Fastify({ logger: true });

await app.register(cors, {
  origin: process.env.CORS_ORIGIN || "http://localhost:5173",
  credentials: true,
});

await app.register(cookie);
await app.register(cachePlugin);
await app.register(authPlugin);

await app.register(healthRoutes);
await app.register(authRoutes, { prefix: "/api/auth" });
await app.register(orgRoutes, { prefix: "/api" });
await app.register(repoRoutes, { prefix: "/api" });
await app.register(workflowRoutes, { prefix: "/api" });

try {
  await app.listen({ port: PORT, host: HOST });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
