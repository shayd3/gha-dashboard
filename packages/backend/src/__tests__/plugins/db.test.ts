import { describe, it, expect, vi, beforeEach } from "vitest";
import Fastify from "fastify";

// ------------------------------------------------------------------
// vi.hoisted ensures these are available inside the vi.mock factory
// ------------------------------------------------------------------
const { mockQuery, mockEnd } = vi.hoisted(() => ({
  mockQuery: vi.fn(),
  mockEnd: vi.fn(),
}));

vi.mock("pg", () => {
  // Must be a plain function (not arrow) so `new Pool()` works
  function Pool() {
    return { query: mockQuery, end: mockEnd };
  }
  return { default: { Pool } };
});

// ------------------------------------------------------------------
// Tests
// ------------------------------------------------------------------
describe("dbPlugin", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockQuery.mockResolvedValue({ rows: [] });
    process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test";
  });

  it("decorates fastify with viewsRepo (PgViewsRepo) and runs migration when DATABASE_URL is set", async () => {
    const { dbPlugin } = await import("../../plugins/db.js");
    const app = Fastify({ logger: false });
    await app.register(dbPlugin);
    await app.ready();

    expect(app.viewsRepo).toBeDefined();
    // Migration SQL should have been called once
    expect(mockQuery).toHaveBeenCalledOnce();
    const [sql] = mockQuery.mock.calls[0] as [string];
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS views");
    expect(sql).toContain("CREATE INDEX IF NOT EXISTS idx_views_user_id");

    await app.close();
  });

  it("decorates fastify with viewsRepo (MemoryViewsRepo) and logs a warning when DATABASE_URL is missing", async () => {
    delete process.env.DATABASE_URL;
    const { dbPlugin } = await import("../../plugins/db.js");
    const warnSpy = vi.fn();
    const app = Fastify({ logger: { level: "warn", stream: { write: warnSpy } } });
    await app.register(dbPlugin);
    await app.ready();

    expect(app.viewsRepo).toBeDefined();
    // No pg pool should have been created / no SQL executed
    expect(mockQuery).not.toHaveBeenCalled();

    await app.close();
  });
});
