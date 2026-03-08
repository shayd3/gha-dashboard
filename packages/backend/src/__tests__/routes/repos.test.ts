import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { buildApp, sessionCookie } from "../helpers.js";
import { repoRoutes } from "../../routes/repos.js";
import type { FastifyInstance } from "fastify";

// ------------------------------------------------------------------
// Mock Octokit methods
// ------------------------------------------------------------------
const mockListForAuthenticatedUser = vi.fn();
const mockListForOrg = vi.fn();
const mockReposGet = vi.fn();

const mockOctokit = {
  rest: {
    repos: {
      listForAuthenticatedUser: mockListForAuthenticatedUser,
      listForOrg: mockListForOrg,
      get: mockReposGet,
    },
  },
};

// ------------------------------------------------------------------
// Fixtures
// ------------------------------------------------------------------
function makeRepo(id: number, name: string, owner: string, isPrivate = false, fork = false, parent?: { full_name: string; owner: { login: string }; name: string; default_branch: string }) {
  return {
    id,
    name,
    full_name: `${owner}/${name}`,
    owner: { login: owner },
    private: isPrivate,
    default_branch: "main",
    html_url: `https://github.com/${owner}/${name}`,
    fork,
    ...(parent ? { parent } : {}),
  };
}

const PERSONAL_REPOS = [makeRepo(1, "my-repo", "testuser")];
const ORG_REPOS = [makeRepo(2, "org-repo", "my-org"), makeRepo(3, "private-repo", "my-org", true)];
const FORK_REPO = makeRepo(4, "forked-repo", "testuser", false, true, {
  full_name: "upstream-org/forked-repo",
  owner: { login: "upstream-org" },
  name: "forked-repo",
  default_branch: "main",
});
const FORK_REPO_NO_PARENT = makeRepo(5, "orphan-fork", "testuser", false, true);

// ------------------------------------------------------------------
// Tests
// ------------------------------------------------------------------
describe("GET /api/orgs/:org/repos", () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    vi.resetAllMocks();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    app = await buildApp(async (a) => {
      await a.register(repoRoutes, { prefix: "/api" });
    }, mockOctokit as any);
  });

  afterEach(async () => {
    await app.close();
  });

  it("returns 401 when unauthenticated", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/orgs/testuser/repos",
    });
    expect(res.statusCode).toBe(401);
  });

  it("calls listForAuthenticatedUser when org matches the session login", async () => {
    mockListForAuthenticatedUser.mockResolvedValue({ data: PERSONAL_REPOS });

    // DEFAULT_SESSION.login = "testuser"
    const cookie = await sessionCookie();
    const res = await app.inject({
      method: "GET",
      url: "/api/orgs/testuser/repos",
      headers: { cookie },
    });

    expect(res.statusCode).toBe(200);
    expect(mockListForAuthenticatedUser).toHaveBeenCalledOnce();
    expect(mockListForOrg).not.toHaveBeenCalled();

    const body = res.json<{ id: number; name: string }[]>();
    expect(body[0]).toMatchObject({ id: 1, name: "my-repo", owner: "testuser" });
  });

  it("filters out repos owned by a different account", async () => {
    // listForAuthenticatedUser returns repos from all orgs the user has access to
    const orgRepoInUserList = makeRepo(10, "org-repo", "some-org");
    mockListForAuthenticatedUser.mockResolvedValue({ data: [...PERSONAL_REPOS, orgRepoInUserList] });

    const cookie = await sessionCookie();
    const res = await app.inject({
      method: "GET",
      url: "/api/orgs/testuser/repos",
      headers: { cookie },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json<{ id: number; owner: string }[]>();
    // Only the testuser-owned repo should be returned
    expect(body).toHaveLength(1);
    expect(body[0]).toMatchObject({ id: 1, owner: "testuser" });
  });

  it("calls listForOrg when org is different from the session login", async () => {
    mockListForOrg.mockResolvedValue({ data: ORG_REPOS });

    const cookie = await sessionCookie();
    const res = await app.inject({
      method: "GET",
      url: "/api/orgs/my-org/repos",
      headers: { cookie },
    });

    expect(res.statusCode).toBe(200);
    expect(mockListForOrg).toHaveBeenCalledOnce();
    expect(mockListForAuthenticatedUser).not.toHaveBeenCalled();

    const body = res.json<{ id: number; name: string; private: boolean }[]>();
    expect(body).toHaveLength(2);
    expect(body[1]).toMatchObject({ name: "private-repo", private: true });
  });

  it("maps repository fields correctly", async () => {
    mockListForOrg.mockResolvedValue({ data: ORG_REPOS });

    const cookie = await sessionCookie();
    const res = await app.inject({
      method: "GET",
      url: "/api/orgs/my-org/repos",
      headers: { cookie },
    });

    const [first] = res.json<
      {
        id: number;
        name: string;
        fullName: string;
        owner: string;
        private: boolean;
        defaultBranch: string;
        url: string;
        isFork: boolean;
      }[]
    >();
    expect(first).toMatchObject({
      id: 2,
      name: "org-repo",
      fullName: "my-org/org-repo",
      owner: "my-org",
      private: false,
      defaultBranch: "main",
      url: "https://github.com/my-org/org-repo",
      isFork: false,
    });
  });

  it("returns fork metadata for forked repos", async () => {
    mockListForAuthenticatedUser.mockResolvedValue({ data: [FORK_REPO] });

    const cookie = await sessionCookie();
    const res = await app.inject({
      method: "GET",
      url: "/api/orgs/testuser/repos",
      headers: { cookie },
    });

    expect(res.statusCode).toBe(200);
    const [first] = res.json<
      {
        id: number;
        name: string;
        isFork: boolean;
        parent?: { fullName: string; owner: string; name: string; defaultBranch: string };
      }[]
    >();
    expect(first.isFork).toBe(true);
    expect(first.parent).toMatchObject({
      fullName: "upstream-org/forked-repo",
      owner: "upstream-org",
      name: "forked-repo",
      defaultBranch: "main",
    });
  });

  it("does not include parent field for non-fork repos", async () => {
    mockListForOrg.mockResolvedValue({ data: ORG_REPOS });

    const cookie = await sessionCookie();
    const res = await app.inject({
      method: "GET",
      url: "/api/orgs/my-org/repos",
      headers: { cookie },
    });

    const body = res.json<{ isFork: boolean; parent?: unknown }[]>();
    expect(body[0].isFork).toBe(false);
    expect(body[0].parent).toBeUndefined();
  });

  it("backfills parent details for forks missing parent data", async () => {
    mockListForAuthenticatedUser.mockResolvedValue({ data: [FORK_REPO_NO_PARENT] });
    mockReposGet.mockResolvedValue({
      data: {
        ...FORK_REPO_NO_PARENT,
        parent: {
          full_name: "upstream-org/orphan-fork",
          owner: { login: "upstream-org" },
          name: "orphan-fork",
          default_branch: "develop",
        },
      },
    });

    const cookie = await sessionCookie();
    const res = await app.inject({
      method: "GET",
      url: "/api/orgs/testuser/repos",
      headers: { cookie },
    });

    expect(res.statusCode).toBe(200);
    expect(mockReposGet).toHaveBeenCalledWith(
      expect.objectContaining({ owner: "testuser", repo: "orphan-fork" })
    );
    const [first] = res.json<{ isFork: boolean; parent?: { fullName: string; owner: string; defaultBranch: string } }[]>();
    expect(first.isFork).toBe(true);
    expect(first.parent).toMatchObject({
      fullName: "upstream-org/orphan-fork",
      owner: "upstream-org",
      defaultBranch: "develop",
    });
  });

  it("gracefully handles failure to backfill parent details", async () => {
    mockListForAuthenticatedUser.mockResolvedValue({ data: [FORK_REPO_NO_PARENT] });
    mockReposGet.mockRejectedValue(new Error("Not found"));

    const cookie = await sessionCookie();
    const res = await app.inject({
      method: "GET",
      url: "/api/orgs/testuser/repos",
      headers: { cookie },
    });

    expect(res.statusCode).toBe(200);
    const [first] = res.json<{ isFork: boolean; parent?: unknown }[]>();
    expect(first.isFork).toBe(true);
    expect(first.parent).toBeUndefined();
  });

  it("returns cached results on second identical request", async () => {
    mockListForOrg.mockResolvedValue({ data: ORG_REPOS });

    const cookie = await sessionCookie();
    await app.inject({ method: "GET", url: "/api/orgs/my-org/repos", headers: { cookie } });
    await app.inject({ method: "GET", url: "/api/orgs/my-org/repos", headers: { cookie } });

    expect(mockListForOrg).toHaveBeenCalledTimes(1);
  });

  it("respects page and per_page query params", async () => {
    mockListForOrg.mockResolvedValue({ data: [] });

    const cookie = await sessionCookie();
    await app.inject({
      method: "GET",
      url: "/api/orgs/my-org/repos?page=2&per_page=10",
      headers: { cookie },
    });

    expect(mockListForOrg).toHaveBeenCalledWith(
      expect.objectContaining({ page: 2, per_page: 10 })
    );
  });
});
