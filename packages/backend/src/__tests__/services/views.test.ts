import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryViewsRepo, PgViewsRepo, ViewLimitError } from "../../services/views.js";
import type pg from "pg";

const USER_ID = 42;

// ===========================================================================
// MemoryViewsRepo
// ===========================================================================
describe("MemoryViewsRepo", () => {
  let repo: MemoryViewsRepo;

  beforeEach(() => {
    repo = new MemoryViewsRepo();
  });

  it("list returns empty array for new user", async () => {
    expect(await repo.list(USER_ID)).toEqual([]);
  });

  it("create and list round-trips correctly", async () => {
    const view = await repo.create(USER_ID, { name: "Test", repos: ["org/a"] });
    expect(view.name).toBe("Test");
    expect(view.repos).toEqual(["org/a"]);
    expect(view.userId).toBe(USER_ID);
    expect(view.position).toBe(0);

    const list = await repo.list(USER_ID);
    expect(list).toHaveLength(1);
    expect(list[0].id).toBe(view.id);
  });

  it("positions increment across creates", async () => {
    await repo.create(USER_ID, { name: "A", repos: [] });
    const b = await repo.create(USER_ID, { name: "B", repos: [] });
    expect(b.position).toBe(1);
  });

  it("list orders by position then createdAt", async () => {
    const a = await repo.create(USER_ID, { name: "A", repos: [] });
    const b = await repo.create(USER_ID, { name: "B", repos: [] });
    const list = await repo.list(USER_ID);
    expect(list[0].id).toBe(a.id);
    expect(list[1].id).toBe(b.id);
  });

  it("get returns null for missing id", async () => {
    expect(await repo.get(USER_ID, "nonexistent")).toBeNull();
  });

  it("get returns the view when found", async () => {
    const view = await repo.create(USER_ID, { name: "V", repos: [] });
    expect((await repo.get(USER_ID, view.id))?.id).toBe(view.id);
  });

  it("update patches name and repos", async () => {
    const view = await repo.create(USER_ID, { name: "Old", repos: ["org/a"] });
    const updated = await repo.update(USER_ID, view.id, { name: "New", repos: ["org/b"] });
    expect(updated?.name).toBe("New");
    expect(updated?.repos).toEqual(["org/b"]);
  });

  it("update returns null for missing view", async () => {
    expect(await repo.update(USER_ID, "bad-id", { name: "X" })).toBeNull();
  });

  it("delete removes the view and returns true", async () => {
    const view = await repo.create(USER_ID, { name: "D", repos: [] });
    expect(await repo.delete(USER_ID, view.id)).toBe(true);
    expect(await repo.list(USER_ID)).toHaveLength(0);
  });

  it("delete returns false for missing view", async () => {
    expect(await repo.delete(USER_ID, "bad-id")).toBe(false);
  });

  it("throws ViewLimitError when at 20 views", async () => {
    for (let i = 0; i < 20; i++) {
      await repo.create(USER_ID, { name: `v${i}`, repos: [] });
    }
    await expect(repo.create(USER_ID, { name: "overflow", repos: [] })).rejects.toBeInstanceOf(ViewLimitError);
  });

  it("throws code 23505 on duplicate name", async () => {
    await repo.create(USER_ID, { name: "dup", repos: [] });
    await expect(repo.create(USER_ID, { name: "dup", repos: [] })).rejects.toMatchObject({ code: "23505" });
  });

  it("isolates views between users", async () => {
    await repo.create(USER_ID, { name: "A", repos: [] });
    expect(await repo.list(99)).toHaveLength(0);
  });
});

// ===========================================================================
// PgViewsRepo
// ===========================================================================
describe("PgViewsRepo", () => {
  const mockQuery = vi.fn();
  const pool = { query: mockQuery } as unknown as pg.Pool;
  let repo: PgViewsRepo;

  const NOW = "2026-03-05T00:00:00.000Z";

  function makeRow(overrides = {}) {
    return {
      id: "uuid-1",
      user_id: USER_ID,
      name: "Test View",
      repos: ["org/repo"],
      filters: null,
      position: 0,
      created_at: NOW,
      updated_at: NOW,
      ...overrides,
    };
  }

  beforeEach(() => {
    vi.clearAllMocks();
    repo = new PgViewsRepo(pool);
  });

  it("list returns mapped views", async () => {
    const row = makeRow();
    mockQuery.mockResolvedValueOnce({ rows: [row] });
    const views = await repo.list(USER_ID);
    expect(views).toHaveLength(1);
    expect(views[0].userId).toBe(USER_ID);
    const [sql, params] = mockQuery.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain("ORDER BY position");
    expect(params).toEqual([USER_ID]);
  });

  it("get returns null when not found", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    expect(await repo.get(USER_ID, "nonexistent")).toBeNull();
  });

  it("get returns the view when found", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [makeRow()] });
    expect((await repo.get(USER_ID, "uuid-1"))?.id).toBe("uuid-1");
  });

  it("create uses position 0 when no views exist", async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ count: "0" }] })
      .mockResolvedValueOnce({ rows: [{ max: null }] })
      .mockResolvedValueOnce({ rows: [makeRow()] });

    await repo.create(USER_ID, { name: "Test View", repos: ["org/repo"] });

    const insertCall = mockQuery.mock.calls[2] as [string, unknown[]];
    expect(insertCall[1][4]).toBe(0); // position = max(-1) + 1 = 0
  });

  it("create throws ViewLimitError when at 20 views", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ count: "20" }] });
    await expect(repo.create(USER_ID, { name: "Over", repos: [] })).rejects.toBeInstanceOf(ViewLimitError);
  });

  it("update returns null when view not found", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    expect(await repo.update(USER_ID, "uuid-1", { name: "New" })).toBeNull();
  });

  it("update returns updated view", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [makeRow({ name: "New" })] });
    expect((await repo.update(USER_ID, "uuid-1", { name: "New" }))?.name).toBe("New");
  });

  it("delete returns true when deleted", async () => {
    mockQuery.mockResolvedValueOnce({ rowCount: 1 });
    expect(await repo.delete(USER_ID, "uuid-1")).toBe(true);
  });

  it("delete returns false when not found", async () => {
    mockQuery.mockResolvedValueOnce({ rowCount: 0 });
    expect(await repo.delete(USER_ID, "nonexistent")).toBe(false);
  });
});

