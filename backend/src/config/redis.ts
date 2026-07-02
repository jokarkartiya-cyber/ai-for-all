import Redis from "ioredis";
import { config } from "../config";
import { logger } from "../utils/logger";

export const redis = new Redis({
  host: config.redis.host,
  port: config.redis.port,
  password: config.redis.password,
  retryStrategy: (times) => Math.min(times * 50, 2000),
  maxRetriesPerRequest: 3,
});

redis.on("connect", () => {
  logger.info("Redis connected");
});

redis.on("error", (err) => {
  logger.error("Redis error", { error: err.message });
});

export async function cacheGet<T>(key: string): Promise<T | null> {
  const data = await redis.get(key);
  return data ? JSON.parse(data) : null;
}

export async function cacheSet(key: string, value: unknown, ttl = 3600): Promise<void> {
  await redis.set(key, JSON.stringify(value), "EX", ttl);
}

export async function cacheDel(key: string): Promise<void> {
  await redis.del(key);
}
