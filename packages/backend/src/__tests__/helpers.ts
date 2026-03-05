import Fastify, { FastifyInstance } from "fastify";
import cookie from "@fastify/cookie";
import { cachePlugin } from "../plugins/cache.js";
import {
  authPlugin,
  createSessionToken,
  SessionPayload,
} from "../plugins/auth.js";
import { Octokit } from "octokit";

export const DEFAULT_SESSION: SessionPayload = {
  githubToken: "test-github-token",
  userId: 42,
  login: "testuser",
};

/**
 * Build a Fastify app with cookies, cache, and auth plugins registered.
 *
 * When `mockOctokit` is provided the authenticate decorator is replaced with a
 * stub that populates `request.session` / `request.octokit` directly from the
 * session cookie (JWT-verified) and the supplied mock instance. This lets route
 * tests assert against the mock without needing to bridge vi.mock across module
 * boundaries.
 */
export async function buildApp(
  registerRoutes?: (app: FastifyInstance) => Promise<void>,
  mockOctokit?: Partial<Octokit>
): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });
  await app.register(cookie);
  await app.register(cachePlugin);

  if (mockOctokit) {
    // Register just the decorators from authPlugin, then override authenticate
    app.decorateRequest("session", undefined as unknown as SessionPayload);
    app.decorateRequest("octokit", undefined as unknown as Octokit);
    app.decorate("authenticate", async (request: import("fastify").FastifyRequest, reply: import("fastify").FastifyReply) => {
      const { verifySessionToken, clearSessionCookie } = await import("../plugins/auth.js");
      const token = request.cookies["gha_session"];
      if (!token) {
        reply.status(401).send({ error: "Not authenticated" });
        return;
      }
      try {
        const session = await verifySessionToken(token);
        request.session = session;
        request.octokit = mockOctokit as Octokit;
      } catch {
        clearSessionCookie(reply);
        reply.status(401).send({ error: "Invalid session" });
      }
    });
  } else {
    await app.register(authPlugin);
  }

  if (registerRoutes) {
    await registerRoutes(app);
  }
  await app.ready();
  return app;
}

/**
 * Returns a Cookie header string containing a valid signed session JWT.
 */
export async function sessionCookie(
  payload: SessionPayload = DEFAULT_SESSION
): Promise<string> {
  const token = await createSessionToken(payload);
  return `gha_session=${token}`;
}

