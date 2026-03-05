import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { buildApp } from "../helpers.js";
import type { FastifyInstance } from "fastify";

describe("MemoryCache (via fastify.cache)", () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = await buildApp();
  });

  afterEach(async () => {
    await app.close();
  });

  it("returns undefined for a key that was never set", () => {
    expect(app.cache.get("missing")).toBeUndefined();
  });

  it("returns the value immediately after set", () => {
    app.cache.set("foo", { hello: "world" }, 60);
    expect(app.cache.get("foo")).toEqual({ hello: "world" });
  });

  it("returns undefined for an expired entry", () => {
    vi.useFakeTimers();
    try {
      app.cache.set("expiring", "data", 1); // 1 second TTL
      vi.advanceTimersByTime(1001);
      expect(app.cache.get("expiring")).toBeUndefined();
    } finally {
      vi.useRealTimers();
    }
  });

  it("does not return expired value before TTL elapses", () => {
    vi.useFakeTimers();
    try {
      app.cache.set("alive", "still here", 5);
      vi.advanceTimersByTime(4999);
      expect(app.cache.get("alive")).toBe("still here");
    } finally {
      vi.useRealTimers();
    }
  });

  it("invalidate removes keys that contain the pattern", () => {
    app.cache.set("42:repos:myorg:1:100", ["repo1"], 60);
    app.cache.set("42:repos:otherapg:1:100", ["repo2"], 60);
    app.cache.set("42:orgs", ["org1"], 60);

    app.cache.invalidate("repos:myorg");

    expect(app.cache.get("42:repos:myorg:1:100")).toBeUndefined();
    expect(app.cache.get("42:repos:otherapg:1:100")).toEqual(["repo2"]);
    expect(app.cache.get("42:orgs")).toEqual(["org1"]);
  });

  it("invalidate does nothing when no keys match", () => {
    app.cache.set("somekey", "value", 60);
    app.cache.invalidate("nomatch");
    expect(app.cache.get("somekey")).toBe("value");
  });

  it("overwriting a key replaces the value and resets TTL", () => {
    vi.useFakeTimers();
    try {
      app.cache.set("key", "v1", 2);
      vi.advanceTimersByTime(1500);
      app.cache.set("key", "v2", 10);
      vi.advanceTimersByTime(1500); // would have expired with original TTL
      expect(app.cache.get("key")).toBe("v2");
    } finally {
      vi.useRealTimers();
    }
  });
});
