import { getServerEnv } from "@/server/config/env";
import {
  MemoryAnalysisCacheStore,
  MemoryScanRunStore,
  UnavailableScanRunStore,
} from "@/server/storage/memory-store";
import { PostgresScanRunStore } from "@/server/storage/postgres/postgres-scan-run-store";
import { RedisAnalysisCacheStore } from "@/server/storage/redis/redis-analysis-cache-store";

declare global {
  var __slcAnalysisCacheStore: RedisAnalysisCacheStore | MemoryAnalysisCacheStore | undefined;
  var __slcScanRunStore:
    | PostgresScanRunStore
    | MemoryScanRunStore
    | UnavailableScanRunStore
    | undefined;
}

function createAnalysisCacheStore() {
  const env = getServerEnv();
  if (env.redis.url) {
    return RedisAnalysisCacheStore.create(env.redis.url);
  }

  return new MemoryAnalysisCacheStore();
}

function createScanRunStore() {
  const env = getServerEnv();
  if (env.postgres.url) {
    return PostgresScanRunStore.create(env.postgres.url);
  }

  const isMockMode =
    process.env.SLC_MOCK_OPENAI === "true" || process.env.SLC_MOCK_SCAN === "true";
  if (env.nodeEnv === "test" || isMockMode) {
    return new MemoryScanRunStore();
  }

  return new UnavailableScanRunStore("POSTGRES_URL missing");
}

export const analysisCacheStore = globalThis.__slcAnalysisCacheStore ?? createAnalysisCacheStore();
export const scanRunStore = globalThis.__slcScanRunStore ?? createScanRunStore();

if (process.env.NODE_ENV !== "production") {
  globalThis.__slcAnalysisCacheStore = analysisCacheStore;
  globalThis.__slcScanRunStore = scanRunStore;
}
