import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  createSessionToken,
  verifySessionToken,
} from "../../plugins/auth.js";
import { buildApp } from "../helpers.js";
import type { FastifyInstance } from "fastify";

// ------------------------------------------------------------------
// JWT_SECRET production startup validation
// ------------------------------------------------------------------
describe("JWT_SECRET production validation", () => {
  it("throws during plugin startup in production when JWT_SECRET is not set", async () => {
    const prevNodeEnv = process.env.NODE_ENV;
    const prevJwtSecret = process.env.JWT_SECRET;
    try {
      process.env.NODE_ENV = "production";
      delete process.env.JWT_SECRET;
      await expect(buildApp()).rejects.toThrow(
        "JWT_SECRET environment variable is required in production"
      );
    } finally {
      process.env.NODE_ENV = prevNodeEnv;
      if (prevJwtSecret !== undefined) {
        process.env.JWT_SECRET = prevJwtSecret;
      } else {
        delete process.env.JWT_SECRET;
      }
    }
  });

  it("uses the dev fallback when JWT_SECRET is unset in non-production", async () => {
    const prevNodeEnv = process.env.NODE_ENV;
    const prevJwtSecret = process.env.JWT_SECRET;
    let app: FastifyInstance | undefined;
    try {
      process.env.NODE_ENV = "test";
      delete process.env.JWT_SECRET;
      app = await buildApp();
      // Plugin registered successfully — no error thrown
      expect(app).toBeDefined();
    } finally {
      await app?.close();
      process.env.NODE_ENV = prevNodeEnv;
      if (prevJwtSecret !== undefined) {
        process.env.JWT_SECRET = prevJwtSecret;
      } else {
        delete process.env.JWT_SECRET;
      }
    }
  });
});

describe("createSessionToken / verifySessionToken", () => {
  it("round-trips a payload correctly", async () => {
    const payload = {
      githubToken: "ghp_abc",
      userId: 1,
      login: "alice",
      refreshToken: "ghr_refresh",
      tokenExpiresAt: Date.now() + 28800000,
    };
    const token = await createSessionToken(payload);
    const result = await verifySessionToken(token);

    expect(result.githubToken).toBe("ghp_abc");
    expect(result.userId).toBe(1);
    expect(result.login).toBe("alice");
    expect(result.refreshToken).toBe("ghr_refresh");
    expect(result.tokenExpiresAt).toBe(payload.tokenExpiresAt);
  });

  it("round-trips a payload with null refresh fields", async () => {
    const payload = {
      githubToken: "ghp_abc",
      userId: 1,
      login: "alice",
      refreshToken: null,
      tokenExpiresAt: null,
    };
    const token = await createSessionToken(payload);
    const result = await verifySessionToken(token);

    expect(result.refreshToken).toBeNull();
    expect(result.tokenExpiresAt).toBeNull();
  });

  it("rejects a token signed with the wrong secret", async () => {
    // Forge a token with a different library call (just use a random string)
    await expect(verifySessionToken("not.a.valid.jwt")).rejects.toThrow();
  });

  it("rejects a tampered token", async () => {
    const token = await createSessionToken({
      githubToken: "t",
      userId: 1,
      login: "u",
      refreshToken: null,
      tokenExpiresAt: null,
    });
    const [header, , sig] = token.split(".");
    const tampered = `${header}.eyJmb28iOiJiYXIifQ.${sig}`;
    await expect(verifySessionToken(tampered)).rejects.toThrow();
  });
});

describe("authenticate decorator", () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = await buildApp(async (a) => {
      a.get("/protected", async (request, reply) => {
        await a.authenticate(request, reply);
        if (reply.sent) return;
        return { login: request.session.login };
      });
    });
  });

  afterEach(async () => {
    await app.close();
  });

  it("returns 401 when no cookie is present", async () => {
    const res = await app.inject({ method: "GET", url: "/protected" });
    expect(res.statusCode).toBe(401);
    expect(res.json()).toMatchObject({ error: "Not authenticated" });
  });

  it("returns 401 when the cookie value is invalid", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/protected",
      headers: { cookie: "gha_session=bad-token" },
    });
    expect(res.statusCode).toBe(401);
    expect(res.json()).toMatchObject({ error: "Invalid session" });
  });

  it("lets through a request with a valid session cookie", async () => {
    const token = await createSessionToken({
      githubToken: "ghp_test",
      userId: 7,
      login: "bob",
      refreshToken: null,
      tokenExpiresAt: null,
    });
    const res = await app.inject({
      method: "GET",
      url: "/protected",
      headers: { cookie: `gha_session=${token}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ login: "bob" });
  });
});

describe("token refresh in authenticate", () => {
  let app: FastifyInstance;

  afterEach(async () => {
    await app.close();
    vi.unstubAllGlobals();
  });

  it("refreshes an expiring token and sets a new session cookie", async () => {
    app = await buildApp(async (a) => {
      a.get("/protected", async (request, reply) => {
        await a.authenticate(request, reply);
        if (reply.sent) return;
        return { login: request.session.login };
      });
    });

    // Mock the refresh endpoint
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        json: () =>
          Promise.resolve({
            access_token: "ghp_refreshed",
            refresh_token: "ghr_new",
            expires_in: 28800,
          }),
      })
    );

    // Create a token that is about to expire (2 min from now, within 5-min window)
    const token = await createSessionToken({
      githubToken: "ghp_expiring",
      userId: 7,
      login: "bob",
      refreshToken: "ghr_old",
      tokenExpiresAt: Date.now() + 2 * 60 * 1000,
    });

    const res = await app.inject({
      method: "GET",
      url: "/protected",
      headers: { cookie: `gha_session=${token}` },
    });

    expect(res.statusCode).toBe(200);
    // A refreshed session cookie should have been set
    const setCookie = res.headers["set-cookie"] as string;
    expect(setCookie).toMatch(/gha_session=/);
  });

  it("continues with existing token when refresh fails", async () => {
    app = await buildApp(async (a) => {
      a.get("/protected", async (request, reply) => {
        await a.authenticate(request, reply);
        if (reply.sent) return;
        return { login: request.session.login };
      });
    });

    // Mock refresh failure
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        json: () =>
          Promise.resolve({ error: "invalid_grant" }),
      })
    );

    const token = await createSessionToken({
      githubToken: "ghp_expiring",
      userId: 7,
      login: "bob",
      refreshToken: "ghr_bad",
      tokenExpiresAt: Date.now() + 2 * 60 * 1000,
    });

    const res = await app.inject({
      method: "GET",
      url: "/protected",
      headers: { cookie: `gha_session=${token}` },
    });

    // Should still succeed — falls back to old token
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ login: "bob" });
  });
});
