import { FastifyPluginAsync, FastifyRequest, FastifyReply } from "fastify";
import fp from "fastify-plugin";
import { SignJWT, jwtVerify } from "jose";
import { Octokit } from "octokit";
const JWT_SECRET_RAW = () => process.env.JWT_SECRET || "dev-secret-change-me";
const JWT_SECRET = () => new TextEncoder().encode(JWT_SECRET_RAW());
const COOKIE_NAME = "gha_session";

export interface SessionPayload {
  githubToken: string;
  userId: number;
  login: string;
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
        const session = await verifySessionToken(token);
        request.session = session;
        request.octokit = new Octokit({ auth: session.githubToken });
      } catch {
        clearSessionCookie(reply);
        reply.status(401).send({ error: "Invalid session" });
      }
    }
  );
};

export const authPlugin = fp(plugin, { name: "auth" });
