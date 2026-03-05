import { describe, it, expect, afterEach } from "vitest";
import { buildApp } from "../helpers.js";
import { healthRoutes } from "../../routes/health.js";
import type { FastifyInstance } from "fastify";

describe("GET /api/health", () => {
  let app: FastifyInstance;

  afterEach(async () => {
    await app.close();
  });

  it("returns 200 with status ok", async () => {
    app = await buildApp(async (a) => {
      await a.register(healthRoutes);
    });

    const res = await app.inject({ method: "GET", url: "/api/health" });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ status: "ok" });
  });

  it("includes an ISO timestamp in the response", async () => {
    app = await buildApp(async (a) => {
      await a.register(healthRoutes);
    });

    const before = Date.now();
    const res = await app.inject({ method: "GET", url: "/api/health" });
    const after = Date.now();

    const { timestamp } = res.json<{ status: string; timestamp: string }>();
    const ts = new Date(timestamp).getTime();
    expect(ts).toBeGreaterThanOrEqual(before);
    expect(ts).toBeLessThanOrEqual(after);
  });
});
