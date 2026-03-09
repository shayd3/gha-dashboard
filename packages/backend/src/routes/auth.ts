import { randomBytes } from "node:crypto";
import { FastifyPluginAsync } from "fastify";
import {
  createSessionToken,
  setSessionCookie,
  clearSessionCookie,
  setOAuthStateCookie,
  getOAuthStateCookie,
  clearOAuthStateCookie,
  githubWebUrl,
} from "../plugins/auth.js";
import { Octokit } from "octokit";

const GITHUB_APP_CLIENT_ID = () => process.env.GITHUB_APP_CLIENT_ID || "";
const GITHUB_APP_CLIENT_SECRET = () =>
  process.env.GITHUB_APP_CLIENT_SECRET || "";
const FRONTEND_URL = () => process.env.FRONTEND_URL || "http://localhost:5173";
const GITHUB_API_URL = () =>
  process.env.GITHUB_API_URL || "https://api.github.com";

export const authRoutes: FastifyPluginAsync = async (fastify) => {
  // Redirect to GitHub App OAuth authorization
  fastify.get("/login", async (_request, reply) => {
    const state = randomBytes(20).toString("hex");
    setOAuthStateCookie(reply, state);

    const githubAuthUrl = `${githubWebUrl()}/login/oauth/authorize`;
    const params = new URLSearchParams({
      client_id: GITHUB_APP_CLIENT_ID(),
      redirect_uri: `${FRONTEND_URL()}/api/auth/callback`,
      state,
    });
    // GitHub App permissions are configured at the App level — no scope param
    reply.redirect(`${githubAuthUrl}?${params}`);
  });

  // OAuth callback
  fastify.get<{ Querystring: { code: string; state?: string } }>(
    "/callback",
    async (request, reply) => {
      const { code, state } = request.query;
      if (!code) {
        reply.status(400).send({ error: "Missing code parameter" });
        return;
      }

      // CSRF state verification
      const expectedState = getOAuthStateCookie(request);
      clearOAuthStateCookie(reply);
      if (!state || !expectedState || state !== expectedState) {
        reply.status(400).send({ error: "Invalid OAuth state" });
        return;
      }

      // Exchange code for access token (GHE-aware URL)
      const tokenUrl = `${githubWebUrl()}/login/oauth/access_token`;
      const tokenResponse = await fetch(tokenUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          client_id: GITHUB_APP_CLIENT_ID(),
          client_secret: GITHUB_APP_CLIENT_SECRET(),
          code,
        }),
      });

      const tokenData = (await tokenResponse.json()) as {
        access_token?: string;
        refresh_token?: string;
        expires_in?: number;
        error?: string;
      };
      if (!tokenData.access_token) {
        reply
          .status(400)
          .send({ error: "Failed to exchange code for token" });
        return;
      }

      // Get user info
      const octokit = new Octokit({
        auth: tokenData.access_token,
        ...(GITHUB_API_URL() !== "https://api.github.com"
          ? { baseUrl: GITHUB_API_URL() }
          : {}),
      });
      const { data: ghUser } = await octokit.rest.users.getAuthenticated();

      const tokenExpiresAt = tokenData.expires_in
        ? Date.now() + tokenData.expires_in * 1000
        : null;

      const sessionToken = await createSessionToken({
        githubToken: tokenData.access_token,
        userId: ghUser.id,
        login: ghUser.login,
        refreshToken: tokenData.refresh_token ?? null,
        tokenExpiresAt,
      });

      setSessionCookie(reply, sessionToken);
      reply.redirect(FRONTEND_URL());
    }
  );

  // Get current user
  fastify.get("/me", async (request, reply) => {
    await fastify.authenticate(request, reply);
    if (reply.sent) return;

    const { data: ghUser } =
      await request.octokit.rest.users.getAuthenticated();
    return {
      id: ghUser.id,
      login: ghUser.login,
      avatarUrl: ghUser.avatar_url,
      name: ghUser.name,
    };
  });

  // Logout
  fastify.post("/logout", async (_request, reply) => {
    clearSessionCookie(reply);
    return { ok: true };
  });
};
