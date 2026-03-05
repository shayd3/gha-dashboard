import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { buildApp, sessionCookie, DEFAULT_SESSION } from "../helpers.js";
import { viewRoutes } from "../../routes/views.js";
import { ViewLimitError, type ViewsRepo } from "../../services/views.js";
import type { FastifyInstance } from "fastify";
import type { View } from "@gha-dashboard/shared";
import type { WorkflowRunConclusion } from "@gha-dashboard/shared";

// ------------------------------------------------------------------
// Mock ViewsRepo — typed to the interface, no SQL involved
// ------------------------------------------------------------------
const mockRepo: {
  [K in keyof ViewsRepo]: ReturnType<typeof vi.fn>;
} = {
  list: vi.fn(),
  get: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
};

// ------------------------------------------------------------------
// Fixtures
// ------------------------------------------------------------------
const NOW = "2026-03-05T00:00:00.000Z";

function makeView(overrides: Partial<View> = {}): View {
  return {
    id: "uuid-1",
    userId: DEFAULT_SESSION.userId,
    name: "My View",
    repos: ["org/repo-a"],
    filters: null,
    position: 0,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

// ------------------------------------------------------------------
// Tests
// ------------------------------------------------------------------
describe("Views routes", () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    vi.resetAllMocks();
    app = await buildApp(async (a) => {
      a.decorate("viewsRepo", mockRepo as unknown as ViewsRepo);
      await a.register(viewRoutes, { prefix: "/api" });
    });
  });

  afterEach(async () => {
    await app.close();
  });

  // ----------------------------------------------------------------
  // Auth gating
  // ----------------------------------------------------------------
  it("returns 401 when unauthenticated on GET /api/views", async () => {
    const res = await app.inject({ method: "GET", url: "/api/views" });
    expect(res.statusCode).toBe(401);
  });

  it("returns 401 when unauthenticated on POST /api/views", async () => {
    const res = await app.inject({ method: "POST", url: "/api/views", payload: { name: "x", repos: [] } });
    expect(res.statusCode).toBe(401);
  });

  // ----------------------------------------------------------------
  // GET /api/views
  // ----------------------------------------------------------------
  describe("GET /api/views", () => {
    it("returns empty array when no views", async () => {
      mockRepo.list.mockResolvedValueOnce([]);
      const cookie = await sessionCookie();
      const res = await app.inject({ method: "GET", url: "/api/views", headers: { cookie } });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual([]);
      expect(mockRepo.list).toHaveBeenCalledWith(DEFAULT_SESSION.userId);
    });

    it("returns views", async () => {
      const view = makeView();
      mockRepo.list.mockResolvedValueOnce([view]);
      const cookie = await sessionCookie();
      const res = await app.inject({ method: "GET", url: "/api/views", headers: { cookie } });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual([view]);
    });
  });

  // ----------------------------------------------------------------
  // POST /api/views
  // ----------------------------------------------------------------
  describe("POST /api/views", () => {
    it("creates a view and returns 201", async () => {
      const view = makeView();
      mockRepo.create.mockResolvedValueOnce(view);
      const cookie = await sessionCookie();
      const res = await app.inject({
        method: "POST",
        url: "/api/views",
        headers: { cookie },
        payload: { name: "My View", repos: ["org/repo-a"] },
      });
      expect(res.statusCode).toBe(201);
      expect(res.json()).toEqual(view);
      expect(mockRepo.create).toHaveBeenCalledWith(DEFAULT_SESSION.userId, {
        name: "My View",
        repos: ["org/repo-a"],
        filters: undefined,
      });
    });

    it("returns 409 on duplicate name", async () => {
      mockRepo.create.mockRejectedValueOnce(
        Object.assign(new Error("duplicate"), { code: "23505" })
      );
      const cookie = await sessionCookie();
      const res = await app.inject({
        method: "POST",
        url: "/api/views",
        headers: { cookie },
        payload: { name: "My View", repos: [] },
      });
      expect(res.statusCode).toBe(409);
    });

    it("returns 400 when over view limit", async () => {
      mockRepo.create.mockRejectedValueOnce(new ViewLimitError());
      const cookie = await sessionCookie();
      const res = await app.inject({
        method: "POST",
        url: "/api/views",
        headers: { cookie },
        payload: { name: "One More", repos: [] },
      });
      expect(res.statusCode).toBe(400);
    });

    it("returns 400 when name or repos are missing", async () => {
      const cookie = await sessionCookie();
      const res = await app.inject({
        method: "POST",
        url: "/api/views",
        headers: { cookie },
        payload: { repos: [] },
      });
      expect(res.statusCode).toBe(400);
      expect(mockRepo.create).not.toHaveBeenCalled();
    });
  });

  // ----------------------------------------------------------------
  // PUT /api/views/:id
  // ----------------------------------------------------------------
  describe("PUT /api/views/:id", () => {
    it("updates a view", async () => {
      const view = makeView({ name: "Renamed" });
      mockRepo.update.mockResolvedValueOnce(view);
      const cookie = await sessionCookie();
      const res = await app.inject({
        method: "PUT",
        url: "/api/views/uuid-1",
        headers: { cookie },
        payload: { name: "Renamed" },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json<View>().name).toBe("Renamed");
    });

    it("returns 404 when view not found", async () => {
      mockRepo.update.mockResolvedValueOnce(null);
      const cookie = await sessionCookie();
      const res = await app.inject({
        method: "PUT",
        url: "/api/views/nonexistent",
        headers: { cookie },
        payload: { name: "X" },
      });
      expect(res.statusCode).toBe(404);
    });

    it("updates repos and filters", async () => {
      const filters = { status: ["success", "failure"] as WorkflowRunConclusion[], branch: "main", workflow: null, event: null };
      const view = makeView({ repos: ["org/repo-b", "org/repo-c"], filters });
      mockRepo.update.mockResolvedValueOnce(view);
      const cookie = await sessionCookie();
      const res = await app.inject({
        method: "PUT",
        url: "/api/views/uuid-1",
        headers: { cookie },
        payload: { repos: ["org/repo-b", "org/repo-c"], filters },
      });
      expect(res.statusCode).toBe(200);
      const body = res.json<View>();
      expect(body.repos).toEqual(["org/repo-b", "org/repo-c"]);
      expect(body.filters).toEqual(filters);
      expect(mockRepo.update).toHaveBeenCalledWith(
        DEFAULT_SESSION.userId,
        "uuid-1",
        { repos: ["org/repo-b", "org/repo-c"], filters },
      );
    });
  });

  // ----------------------------------------------------------------
  // DELETE /api/views/:id
  // ----------------------------------------------------------------
  describe("DELETE /api/views/:id", () => {
    it("deletes a view and returns 204", async () => {
      mockRepo.delete.mockResolvedValueOnce(true);
      const cookie = await sessionCookie();
      const res = await app.inject({
        method: "DELETE",
        url: "/api/views/uuid-1",
        headers: { cookie },
      });
      expect(res.statusCode).toBe(204);
    });

    it("returns 404 when view not found", async () => {
      mockRepo.delete.mockResolvedValueOnce(false);
      const cookie = await sessionCookie();
      const res = await app.inject({
        method: "DELETE",
        url: "/api/views/nonexistent",
        headers: { cookie },
      });
      expect(res.statusCode).toBe(404);
    });
  });
});

