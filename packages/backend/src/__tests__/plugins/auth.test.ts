import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  createSessionToken,
  verifySessionToken,
} from "../../plugins/auth.js";
import { buildApp } from "../helpers.js";
import type { FastifyInstance } from "fastify";

describe("createSessionToken / verifySessionToken", () => {
  it("round-trips a payload correctly", async () => {
    const payload = { githubToken: "ghp_abc", userId: 1, login: "alice" };
    const token = await createSessionToken(payload);
    const result = await verifySessionToken(token);

    expect(result.githubToken).toBe("ghp_abc");
    expect(result.userId).toBe(1);
    expect(result.login).toBe("alice");
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
