import { FastifyPluginAsync, FastifyRequest, FastifyReply } from "fastify";
import fp from "fastify-plugin";
import { SignJWT, jwtVerify } from "jose";
import { Octokit } from "octokit";

const JWT_SECRET_RAW = () => {
  const secret = process.env.JWT_SECRET;
  if (!secret && process.env.NODE_ENV === "production") {
    throw new Error("JWT_SECRET environment variable is required in production");
  }
  return secret || "dev-secret-change-me";
};
const JWT_SECRET = () => new TextEncoder().encode(JWT_SECRET_RAW());
const COOKIE_NAME = "gha_session";
const OAUTH_STATE_COOKIE = "gha_oauth_state";

const GITHUB_APP_CLIENT_ID = () => process.env.GITHUB_APP_CLIENT_ID || "";
const GITHUB_APP_CLIENT_SECRET = () =>
  process.env.GITHUB_APP_CLIENT_SECRET || "";
const GITHUB_API_URL = () =>
  process.env.GITHUB_API_URL || "https://api.github.com";

/** Derive the base web URL from the API URL (handles GHE and github.com). */
export function githubWebUrl(): string {
  return GITHUB_API_URL().replace("api.", "").replace("/api/v3", "");
}

export interface SessionPayload {
  githubToken: string;
  userId: number;
  login: string;
  refreshToken: string | null;
  tokenExpiresAt: number | null; // epoch ms
}

declare module "fastify" {
  interface FastifyInstance {
    authenticate: (
      request: FastifyRequest,
      reply: FastifyReply
    ) => Promise<void>;
  }
  interface FastifyRequest {
    session: SessionPayload;
    octokit: Octokit;
  }
}

export async function createSessionToken(
  payload: SessionPayload
): Promise<string> {
  return new SignJWT(payload as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("8h")
    .sign(JWT_SECRET());
}

export async function verifySessionToken(
  token: string
): Promise<SessionPayload> {
  const { payload } = await jwtVerify(token, JWT_SECRET());
  return payload as unknown as SessionPayload;
}

export function setSessionCookie(reply: FastifyReply, token: string): void {
  reply.setCookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 8 * 60 * 60, // 8 hours
  });
}

export function clearSessionCookie(reply: FastifyReply): void {
  reply.clearCookie(COOKIE_NAME, { path: "/" });
}

export function setOAuthStateCookie(reply: FastifyReply, state: string): void {
  reply.setCookie(OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 10 * 60, // 10 minutes
  });
}

export function getOAuthStateCookie(
  request: FastifyRequest
): string | undefined {
  return request.cookies[OAUTH_STATE_COOKIE];
}

export function clearOAuthStateCookie(reply: FastifyReply): void {
  reply.clearCookie(OAUTH_STATE_COOKIE, { path: "/" });
}

// ----------------------------------------------------------------
// Token refresh for GitHub App user-to-server tokens
// ----------------------------------------------------------------

export interface RefreshResult {
  accessToken: string;
  refreshToken: string;
  expiresIn: number; // seconds
}

export async function refreshGitHubToken(
  refreshToken: string
): Promise<RefreshResult> {
  const tokenUrl = `${githubWebUrl()}/login/oauth/access_token`;
  const res = await fetch(tokenUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      client_id: GITHUB_APP_CLIENT_ID(),
      client_secret: GITHUB_APP_CLIENT_SECRET(),
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });

  const data = (await res.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    error?: string;
  };

  if (!data.access_token || !data.refresh_token) {
    throw new Error(data.error || "Failed to refresh GitHub token");
  }

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresIn: data.expires_in ?? 28800,
  };
}

// ----------------------------------------------------------------
// Fastify plugin
// ----------------------------------------------------------------

const REFRESH_WINDOW_MS = 5 * 60 * 1000; // refresh 5 min before expiry

const plugin: FastifyPluginAsync = async (fastify) => {
  fastify.decorateRequest("session", undefined as unknown as SessionPayload);
  fastify.decorateRequest("octokit", undefined as unknown as Octokit);

  fastify.decorate(
    "authenticate",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const token = request.cookies[COOKIE_NAME];
      if (!token) {
        reply.status(401).send({ error: "Not authenticated" });
        return;
      }
      try {
        let session = await verifySessionToken(token);

        // Proactively refresh the GitHub token if it's close to expiring
        if (
          session.refreshToken &&
          session.tokenExpiresAt &&
          Date.now() > session.tokenExpiresAt - REFRESH_WINDOW_MS
        ) {
          try {
            const refreshed = await refreshGitHubToken(session.refreshToken);
            session = {
              ...session,
              githubToken: refreshed.accessToken,
              refreshToken: refreshed.refreshToken,
              tokenExpiresAt: Date.now() + refreshed.expiresIn * 1000,
            };
            const newJwt = await createSessionToken(session);
            setSessionCookie(reply, newJwt);
          } catch {
            // Refresh failed — continue with the existing token if it hasn't
            // expired yet; if it has, the Octokit call will 401 and the user
            // will need to re-authenticate.
          }
        }

        request.session = session;

        const octokitOpts: ConstructorParameters<typeof Octokit>[0] = {
          auth: session.githubToken,
        };
        if (GITHUB_API_URL() !== "https://api.github.com") {
          octokitOpts.baseUrl = GITHUB_API_URL();
        }
        request.octokit = new Octokit(octokitOpts);
      } catch {
        clearSessionCookie(reply);
        reply.status(401).send({ error: "Invalid session" });
      }
    }
  );
};

export const authPlugin = fp(plugin, { name: "auth" });
