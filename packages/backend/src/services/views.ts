import type pg from "pg";
import type { View, CreateViewInput, UpdateViewInput, DashboardFilters } from "@gha-dashboard/shared";
import { randomUUID } from "node:crypto";

// ---------------------------------------------------------------------------
// Repository interface — implemented by both PgViewsRepo and MemoryViewsRepo
// ---------------------------------------------------------------------------

export interface ViewsRepo {
  list(userId: number): Promise<View[]>;
  get(userId: number, viewId: string): Promise<View | null>;
  create(userId: number, input: CreateViewInput): Promise<View>;
  update(userId: number, viewId: string, input: UpdateViewInput): Promise<View | null>;
  delete(userId: number, viewId: string): Promise<boolean>;
}

// ---------------------------------------------------------------------------
// Error thrown when the 20-view limit is exceeded
// ---------------------------------------------------------------------------

export class ViewLimitError extends Error {
  readonly code = "LIMIT_EXCEEDED";
  constructor() {
    super("View limit of 20 reached");
  }
}

// ---------------------------------------------------------------------------
// In-memory implementation (used when DATABASE_URL is not configured)
// ---------------------------------------------------------------------------

interface MemRow {
  id: string;
  userId: number;
  name: string;
  repos: string[];
  filters: DashboardFilters | null;
  position: number;
  createdAt: string;
  updatedAt: string;
}

export class MemoryViewsRepo implements ViewsRepo {
  private rows: MemRow[] = [];

  async list(userId: number): Promise<View[]> {
    return this.rows
      .filter((r) => r.userId === userId)
      .sort((a, b) => a.position - b.position || a.createdAt.localeCompare(b.createdAt))
      .map((r) => ({ ...r }));
  }

  async get(userId: number, viewId: string): Promise<View | null> {
    const row = this.rows.find((r) => r.id === viewId && r.userId === userId);
    return row ? { ...row } : null;
  }

  async create(userId: number, input: CreateViewInput): Promise<View> {
    const userRows = this.rows.filter((r) => r.userId === userId);
    if (userRows.length >= 20) throw new ViewLimitError();
    if (userRows.some((r) => r.name === input.name)) {
      throw Object.assign(new Error(`A view named "${input.name}" already exists`), { code: "23505" });
    }
    const position = userRows.length === 0 ? 0 : Math.max(...userRows.map((r) => r.position)) + 1;
    const now = new Date().toISOString();
    const row: MemRow = {
      id: randomUUID(),
      userId,
      name: input.name,
      repos: input.repos,
      filters: input.filters ?? null,
      position,
      createdAt: now,
      updatedAt: now,
    };
    this.rows.push(row);
    return { ...row };
  }

  async update(userId: number, viewId: string, input: UpdateViewInput): Promise<View | null> {
    const row = this.rows.find((r) => r.id === viewId && r.userId === userId);
    if (!row) return null;
    if (input.name !== undefined) row.name = input.name;
    if (input.repos !== undefined) row.repos = input.repos;
    if (input.filters !== undefined) row.filters = input.filters;
    if (input.position !== undefined) row.position = input.position;
    row.updatedAt = new Date().toISOString();
    return { ...row };
  }

  async delete(userId: number, viewId: string): Promise<boolean> {
    const idx = this.rows.findIndex((r) => r.id === viewId && r.userId === userId);
    if (idx === -1) return false;
    this.rows.splice(idx, 1);
    return true;
  }
}

// ---------------------------------------------------------------------------
// PostgreSQL implementation
// ---------------------------------------------------------------------------

interface DbRow {
  id: string;
  user_id: number;
  name: string;
  repos: string[];
  filters: DashboardFilters | null;
  position: number;
  created_at: string;
  updated_at: string;
}

function pgRowToView(row: DbRow): View {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    repos: row.repos,
    filters: row.filters,
    position: row.position,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class PgViewsRepo implements ViewsRepo {
  constructor(private readonly pool: pg.Pool) {}

  async list(userId: number): Promise<View[]> {
    const result = await this.pool.query<DbRow>(
      "SELECT * FROM views WHERE user_id = $1 ORDER BY position ASC, created_at ASC",
      [userId]
    );
    return result.rows.map(pgRowToView);
  }

  async get(userId: number, viewId: string): Promise<View | null> {
    const result = await this.pool.query<DbRow>(
      "SELECT * FROM views WHERE id = $1 AND user_id = $2",
      [viewId, userId]
    );
    return result.rows.length ? pgRowToView(result.rows[0]) : null;
  }

  async create(userId: number, input: CreateViewInput): Promise<View> {
    const countResult = await this.pool.query<{ count: string }>(
      "SELECT COUNT(*) as count FROM views WHERE user_id = $1",
      [userId]
    );
    if (parseInt(countResult.rows[0].count, 10) >= 20) throw new ViewLimitError();

    const maxResult = await this.pool.query<{ max: number | null }>(
      "SELECT MAX(position) as max FROM views WHERE user_id = $1",
      [userId]
    );
    const position = (maxResult.rows[0].max ?? -1) + 1;

    const result = await this.pool.query<DbRow>(
      `INSERT INTO views (user_id, name, repos, filters, position)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [userId, input.name, JSON.stringify(input.repos), input.filters ? JSON.stringify(input.filters) : null, position]
    );
    return pgRowToView(result.rows[0]);
  }

  async update(userId: number, viewId: string, input: UpdateViewInput): Promise<View | null> {
    const setClauses: string[] = ["updated_at = now()"];
    const values: unknown[] = [];
    let idx = 1;

    if (input.name !== undefined) { setClauses.push(`name = $${idx++}`); values.push(input.name); }
    if (input.repos !== undefined) { setClauses.push(`repos = $${idx++}`); values.push(JSON.stringify(input.repos)); }
    if (input.filters !== undefined) { setClauses.push(`filters = $${idx++}`); values.push(JSON.stringify(input.filters)); }
    if (input.position !== undefined) { setClauses.push(`position = $${idx++}`); values.push(input.position); }

    values.push(viewId, userId);

    const result = await this.pool.query<DbRow>(
      `UPDATE views SET ${setClauses.join(", ")} WHERE id = $${idx++} AND user_id = $${idx} RETURNING *`,
      values
    );
    return result.rows.length ? pgRowToView(result.rows[0]) : null;
  }

  async delete(userId: number, viewId: string): Promise<boolean> {
    const result = await this.pool.query(
      "DELETE FROM views WHERE id = $1 AND user_id = $2",
      [viewId, userId]
    );
    return (result.rowCount ?? 0) > 0;
  }
}
