import { FastifyPluginAsync } from "fastify";
import {
  createSessionToken,
  setSessionCookie,
  clearSessionCookie,
} from "../plugins/auth.js";
import { Octokit } from "octokit";

const GITHUB_CLIENT_ID = () => process.env.GITHUB_CLIENT_ID || "";
const GITHUB_CLIENT_SECRET = () => process.env.GITHUB_CLIENT_SECRET || "";
const FRONTEND_URL = () => process.env.FRONTEND_URL || "http://localhost:5173";
const GITHUB_API_URL = () =>
  process.env.GITHUB_API_URL || "https://api.github.com";

export const authRoutes: FastifyPluginAsync = async (fastify) => {
  // Redirect to GitHub OAuth
  fastify.get("/login", async (_request, reply) => {
    const githubAuthUrl =
      GITHUB_API_URL().replace("api.", "").replace("/api/v3", "") +
      "/login/oauth/authorize";
    const params = new URLSearchParams({
      client_id: GITHUB_CLIENT_ID(),
      scope: "repo read:org",
      redirect_uri: `${_request.protocol}://${_request.hostname}/api/auth/callback`,
    });
    reply.redirect(`${githubAuthUrl}?${params}`);
  });

  // OAuth callback
  fastify.get<{ Querystring: { code: string } }>(
    "/callback",
    async (request, reply) => {
      const { code } = request.query;
      if (!code) {
        reply.status(400).send({ error: "Missing code parameter" });
        return;
      }

      // Exchange code for access token
      const tokenResponse = await fetch(
        "https://github.com/login/oauth/access_token",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({
            client_id: GITHUB_CLIENT_ID(),
            client_secret: GITHUB_CLIENT_SECRET(),
            code,
          }),
        }
      );

      const tokenData = (await tokenResponse.json()) as {
        access_token?: string;
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

      const sessionToken = await createSessionToken({
        githubToken: tokenData.access_token,
        userId: ghUser.id,
        login: ghUser.login,
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
