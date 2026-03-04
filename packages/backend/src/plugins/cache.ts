import { FastifyPluginAsync } from "fastify";
import fp from "fastify-plugin";

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

class MemoryCache {
  private store = new Map<string, CacheEntry<unknown>>();

  get<T>(key: string): T | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return undefined;
    }
    return entry.data as T;
  }

  set<T>(key: string, data: T, ttlSeconds: number): void {
    this.store.set(key, {
      data,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
  }

  invalidate(pattern: string): void {
    for (const key of this.store.keys()) {
      if (key.includes(pattern)) {
        this.store.delete(key);
      }
    }
  }
}

declare module "fastify" {
  interface FastifyInstance {
    cache: MemoryCache;
  }
}

const plugin: FastifyPluginAsync = async (fastify) => {
  const cache = new MemoryCache();
  fastify.decorate("cache", cache);
};

export const cachePlugin = fp(plugin, { name: "cache" });
