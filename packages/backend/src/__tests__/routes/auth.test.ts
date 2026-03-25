import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { buildApp, sessionCookie } from "../helpers.js";
import { authRoutes } from "../../routes/auth.js";
import type { FastifyInstance } from "fastify";

// ------------------------------------------------------------------
// The /callback route creates `new Octokit(...)` internally to fetch
// the GitHub user after exchanging the code. We mock the module so
// that instance also returns our mock methods.
// ------------------------------------------------------------------
const mockGetAuthenticated = vi.hoisted(() => vi.fn());

const mockOctokit = vi.hoisted(() => ({
  rest: {
    users: { getAuthenticated: mockGetAuthenticated },
  },
}));

vi.mock("octokit", () => ({
  Octokit: class MockOctokit {
    rest = mockOctokit.rest;
  },
}));

// ------------------------------------------------------------------
// Helpers
// ------------------------------------------------------------------
function mockFetchTokenSuccess(
  accessToken = "ghp_test123",
  refreshToken = "ghr_refresh123",
  expiresIn = 28800
) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      json: () =>
        Promise.resolve({
          access_token: accessToken,
          refresh_token: refreshToken,
          expires_in: expiresIn,
        }),
    })
  );
}

function mockFetchTokenFailure() {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      json: () => Promise.resolve({ error: "bad_verification_code" }),
    })
  );
}

/**
 * Temporarily set FRONTEND_URL for the duration of the test callback,
 * then restore the original value.
 */
async function withFrontendUrl<T>(url: string, fn: () => Promise<T>): Promise<T> {
  const prev = process.env.FRONTEND_URL;
  process.env.FRONTEND_URL = url;
  try {
    return await fn();
  } finally {
    if (prev === undefined) delete process.env.FRONTEND_URL;
    else process.env.FRONTEND_URL = prev;
  }
}

/**
 * Perform the login redirect to get a valid state cookie,
 * then return the state value and cookie header string.
 */
async function getStateCookie(app: FastifyInstance) {
  const loginRes = await app.inject({ method: "GET", url: "/api/auth/login" });
  const location = loginRes.headers["location"] as string;
  const stateParam = new URL(location).searchParams.get("state")!;
  const setCookie = loginRes.headers["set-cookie"] as string;
  // Extract the gha_oauth_state cookie
  const stateCookieMatch = (
    Array.isArray(setCookie) ? setCookie.join("; ") : setCookie
  ).match(/gha_oauth_state=([^;]+)/);
  const stateCookie = stateCookieMatch
    ? `gha_oauth_state=${stateCookieMatch[1]}`
    : "";
  return { stateParam, stateCookie };
}

// ------------------------------------------------------------------
// Tests
// ------------------------------------------------------------------
describe("Auth routes", () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    vi.clearAllMocks();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    app = await buildApp(async (a) => {
      await a.register(authRoutes, { prefix: "/api/auth" });
    }, mockOctokit as any);
  });

  afterEach(async () => {
    await app.close();
    vi.unstubAllGlobals();
  });
  // ----------------------------------------------------------------
  // GET /api/auth/login
  // ----------------------------------------------------------------
  describe("GET /api/auth/login", () => {
    it("redirects to the GitHub OAuth authorization URL", async () => {
      const res = await app.inject({ method: "GET", url: "/api/auth/login" });

      expect(res.statusCode).toBe(302);
      const location = res.headers["location"] as string;
      expect(location).toContain("github.com/login/oauth/authorize");
    });

    it("includes the client_id and state in the redirect URL (no scope param)", async () => {
      const previousClientId = process.env.GITHUB_APP_CLIENT_ID;
      try {
        process.env.GITHUB_APP_CLIENT_ID = "my-app-client-id";
        const res = await app.inject({ method: "GET", url: "/api/auth/login" });
        const location = res.headers["location"] as string;

        expect(location).toContain("client_id=my-app-client-id");
        expect(location).toContain("state=");
        // GitHub App — no scope param
        expect(location).not.toContain("scope=");
      } finally {
        if (previousClientId === undefined) {
          delete process.env.GITHUB_APP_CLIENT_ID;
        } else {
          process.env.GITHUB_APP_CLIENT_ID = previousClientId;
        }
      }
    });

    it("sets an OAuth state cookie for CSRF protection", async () => {
      const res = await app.inject({ method: "GET", url: "/api/auth/login" });
      const setCookie = res.headers["set-cookie"] as string;
      const cookies = Array.isArray(setCookie) ? setCookie : [setCookie ?? ""];
      const stateCookie = cookies.find((c) => c.includes("gha_oauth_state"));
      expect(stateCookie).toBeDefined();
    });

    it("sets Secure flag on OAuth state cookie when FRONTEND_URL is https", async () => {
      await withFrontendUrl("https://example.com", async () => {
        const res = await app.inject({ method: "GET", url: "/api/auth/login" });
        const setCookie = res.headers["set-cookie"] as string | string[];
        const cookies = Array.isArray(setCookie) ? setCookie : [setCookie ?? ""];
        const stateCookie = cookies.find((c) => c.includes("gha_oauth_state"));
        expect(stateCookie).toMatch(/;\s*Secure/i);
      });
    });

    it("does not set Secure flag on OAuth state cookie when FRONTEND_URL is http", async () => {
      await withFrontendUrl("http://192.168.1.10:30080", async () => {
        const res = await app.inject({ method: "GET", url: "/api/auth/login" });
        const setCookie = res.headers["set-cookie"] as string | string[];
        const cookies = Array.isArray(setCookie) ? setCookie : [setCookie ?? ""];
        const stateCookie = cookies.find((c) => c.includes("gha_oauth_state"));
        expect(stateCookie).not.toMatch(/;\s*Secure/i);
      });
    });
  });

  // ----------------------------------------------------------------
  // GET /api/auth/callback
  // ----------------------------------------------------------------
  describe("GET /api/auth/callback", () => {
    it("returns 400 when the code query param is missing", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/auth/callback",
      });
      expect(res.statusCode).toBe(400);
      expect(res.json()).toMatchObject({ error: "Missing code parameter" });
    });

    it("returns 400 when the state param is missing or doesn't match", async () => {
      mockFetchTokenSuccess();
      const { stateCookie } = await getStateCookie(app);
      const res = await app.inject({
        method: "GET",
        url: "/api/auth/callback?code=validcode&state=wrong-state",
        headers: { cookie: stateCookie },
      });
      expect(res.statusCode).toBe(400);
      expect(res.json()).toMatchObject({ error: "Invalid OAuth state" });
    });

    it("returns 400 when no state cookie is present", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/auth/callback?code=validcode&state=some-state",
      });
      expect(res.statusCode).toBe(400);
      expect(res.json()).toMatchObject({ error: "Invalid OAuth state" });
    });

    it("returns 400 when GitHub token exchange returns an error", async () => {
      mockFetchTokenFailure();
      const { stateParam, stateCookie } = await getStateCookie(app);
      const res = await app.inject({
        method: "GET",
        url: `/api/auth/callback?code=badcode&state=${stateParam}`,
        headers: { cookie: stateCookie },
      });
      expect(res.statusCode).toBe(400);
      expect(res.json()).toMatchObject({
        error: "Failed to exchange code for token",
      });
    });

    it("sets a session cookie and redirects on success", async () => {
      mockFetchTokenSuccess("ghp_valid", "ghr_refresh", 28800);
      mockGetAuthenticated.mockResolvedValue({
        data: { id: 99, login: "alice", avatar_url: "", name: "Alice" },
      });

      const { stateParam, stateCookie } = await getStateCookie(app);
      const res = await app.inject({
        method: "GET",
        url: `/api/auth/callback?code=validcode&state=${stateParam}`,
        headers: { cookie: stateCookie },
      });

      expect(res.statusCode).toBe(302);
      const setCookie = res.headers["set-cookie"];
      const cookies = Array.isArray(setCookie) ? setCookie : [setCookie ?? ""];
      const sessionCookieSet = cookies.some((c) => c.includes("gha_session="));
      expect(sessionCookieSet).toBe(true);
    });

    it("sets Secure flag on session cookie when FRONTEND_URL is https", async () => {
      await withFrontendUrl("https://example.com", async () => {
        mockFetchTokenSuccess("ghp_valid", "ghr_refresh", 28800);
        mockGetAuthenticated.mockResolvedValue({
          data: { id: 99, login: "alice", avatar_url: "", name: "Alice" },
        });

        const { stateParam, stateCookie } = await getStateCookie(app);
        const res = await app.inject({
          method: "GET",
          url: `/api/auth/callback?code=validcode&state=${stateParam}`,
          headers: { cookie: stateCookie },
        });

        expect(res.statusCode).toBe(302);
        const setCookie = res.headers["set-cookie"] as string | string[];
        const cookies = Array.isArray(setCookie) ? setCookie : [setCookie ?? ""];
        const sessionCookieHeader = cookies.find((c) => c.includes("gha_session="));
        expect(sessionCookieHeader).toMatch(/;\s*Secure/i);
      });
    });

    it("does not set Secure flag on session cookie when FRONTEND_URL is http", async () => {
      await withFrontendUrl("http://192.168.1.10:30080", async () => {
        mockFetchTokenSuccess("ghp_valid", "ghr_refresh", 28800);
        mockGetAuthenticated.mockResolvedValue({
          data: { id: 99, login: "alice", avatar_url: "", name: "Alice" },
        });

        const { stateParam, stateCookie } = await getStateCookie(app);
        const res = await app.inject({
          method: "GET",
          url: `/api/auth/callback?code=validcode&state=${stateParam}`,
          headers: { cookie: stateCookie },
        });

        expect(res.statusCode).toBe(302);
        const setCookie = res.headers["set-cookie"] as string | string[];
        const cookies = Array.isArray(setCookie) ? setCookie : [setCookie ?? ""];
        const sessionCookieHeader = cookies.find((c) => c.includes("gha_session="));
        expect(sessionCookieHeader).not.toMatch(/;\s*Secure/i);
      });
    });
  });

  // ----------------------------------------------------------------
  // GET /api/auth/me
  // ----------------------------------------------------------------
  describe("GET /api/auth/me", () => {
    it("returns 401 without a session cookie", async () => {
      const res = await app.inject({ method: "GET", url: "/api/auth/me" });
      expect(res.statusCode).toBe(401);
    });

    it("returns the authenticated user's profile", async () => {
      mockGetAuthenticated.mockResolvedValue({
        data: {
          id: 42,
          login: "testuser",
          avatar_url: "https://github.com/avatars/testuser",
          name: "Test User",
        },
      });

      const cookie = await sessionCookie();
      const res = await app.inject({
        method: "GET",
        url: "/api/auth/me",
        headers: { cookie },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({
        id: 42,
        login: "testuser",
        avatarUrl: "https://github.com/avatars/testuser",
        name: "Test User",
      });
    });
  });

  // ----------------------------------------------------------------
  // POST /api/auth/logout
  // ----------------------------------------------------------------
  describe("POST /api/auth/logout", () => {
    it("clears the session cookie and returns ok", async () => {
      const cookie = await sessionCookie();
      const res = await app.inject({
        method: "POST",
        url: "/api/auth/logout",
        headers: { cookie },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({ ok: true });
      const setCookie = res.headers["set-cookie"] as string | string[];
      const cookies = Array.isArray(setCookie) ? setCookie : [setCookie ?? ""];
      const sessionCookieHeader = cookies.find((c) =>
        c.includes("gha_session")
      );
      expect(sessionCookieHeader).toBeDefined();
    });
  });
});
