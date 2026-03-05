import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { buildApp, sessionCookie, DEFAULT_SESSION } from "../helpers.js";
import { orgRoutes } from "../../routes/orgs.js";
import type { FastifyInstance } from "fastify";

// ------------------------------------------------------------------
// Mock Octokit methods
// ------------------------------------------------------------------
const mockGetAuthenticated = vi.fn();
const mockListForAuthenticatedUser = vi.fn();

const mockOctokit = {
  rest: {
    users: { getAuthenticated: mockGetAuthenticated },
    orgs: { listForAuthenticatedUser: mockListForAuthenticatedUser },
  },
};

// ------------------------------------------------------------------
// Fixtures
// ------------------------------------------------------------------
const MOCK_USER = {
  id: 42,
  login: "testuser",
  avatar_url: "https://github.com/testuser.png",
};

const MOCK_ORGS = [
  { id: 100, login: "my-org", avatar_url: "https://github.com/my-org.png", description: "Cool org" },
  { id: 101, login: "another-org", avatar_url: "https://github.com/another.png", description: null },
];

// ------------------------------------------------------------------
// Tests
// ------------------------------------------------------------------
describe("GET /api/orgs", () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    vi.resetAllMocks();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    app = await buildApp(async (a) => {
      await a.register(orgRoutes, { prefix: "/api" });
    }, mockOctokit as any);
  });

  afterEach(async () => {
    await app.close();
  });

  it("returns 401 when unauthenticated", async () => {
    const res = await app.inject({ method: "GET", url: "/api/orgs" });
    expect(res.statusCode).toBe(401);
  });

  it("returns the personal user entry followed by orgs", async () => {
    mockGetAuthenticated.mockResolvedValue({ data: MOCK_USER });
    mockListForAuthenticatedUser.mockResolvedValue({ data: MOCK_ORGS });

    const cookie = await sessionCookie();
    const res = await app.inject({
      method: "GET",
      url: "/api/orgs",
      headers: { cookie },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json<{ id: number; login: string; description: string | null }[]>();

    // First entry is always the personal user
    expect(body[0]).toMatchObject({ id: 42, login: "testuser" });
    expect(body[0].description).toBe("Your personal repositories");

    // Followed by the orgs
    expect(body[1]).toMatchObject({ id: 100, login: "my-org", description: "Cool org" });
    expect(body[2]).toMatchObject({ id: 101, login: "another-org", description: null });
  });

  it("returns results from cache on second identical request", async () => {
    mockGetAuthenticated.mockResolvedValue({ data: MOCK_USER });
    mockListForAuthenticatedUser.mockResolvedValue({ data: MOCK_ORGS });

    const cookie = await sessionCookie();
    await app.inject({ method: "GET", url: "/api/orgs", headers: { cookie } });
    await app.inject({ method: "GET", url: "/api/orgs", headers: { cookie } });

    // GitHub APIs should only have been called once
    expect(mockGetAuthenticated).toHaveBeenCalledTimes(1);
    expect(mockListForAuthenticatedUser).toHaveBeenCalledTimes(1);
  });

  it("does not share cache across different users", async () => {
    mockGetAuthenticated.mockResolvedValue({ data: MOCK_USER });
    mockListForAuthenticatedUser.mockResolvedValue({ data: MOCK_ORGS });

    const cookie1 = await sessionCookie({ ...DEFAULT_SESSION, userId: 1 });
    const cookie2 = await sessionCookie({ ...DEFAULT_SESSION, userId: 2 });

    await app.inject({ method: "GET", url: "/api/orgs", headers: { cookie: cookie1 } });
    await app.inject({ method: "GET", url: "/api/orgs", headers: { cookie: cookie2 } });

    expect(mockGetAuthenticated).toHaveBeenCalledTimes(2);
  });
});
