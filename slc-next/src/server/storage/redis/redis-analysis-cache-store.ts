import Redis from "ioredis";

import { roastPipelineConfig } from "@/server/config/roast-pipeline-config";
import type { AnalysisCacheStore, PersistedAnalysisState } from "@/server/storage/types";

export class RedisAnalysisCacheStore implements AnalysisCacheStore {
  constructor(private readonly redis: Redis) {}

  static create(url: string) {
    return new RedisAnalysisCacheStore(new Redis(url, { lazyConnect: true, maxRetriesPerRequest: 1 }));
  }

  private analysisKey(analysisId: string) {
    return `slc:analysis:${analysisId}`;
  }

  private snapshotKey(snapshotHash: string) {
    return `slc:snapshot:${snapshotHash}`;
  }

  async getBySnapshotHash(snapshotHash: string) {
    await this.redis.connect().catch(() => undefined);
    const analysisId = await this.redis.get(this.snapshotKey(snapshotHash));
    return analysisId ? this.getByAnalysisId(analysisId) : null;
  }

  async getByAnalysisId(analysisId: string) {
    await this.redis.connect().catch(() => undefined);
    const payload = await this.redis.get(this.analysisKey(analysisId));
    return payload ? (JSON.parse(payload) as PersistedAnalysisState) : null;
  }

  async save(state: PersistedAnalysisState) {
    await this.redis.connect().catch(() => undefined);
    const ttl = roastPipelineConfig.cache.checkpointTtlSec;
    await this.redis.multi()
      .set(this.analysisKey(state.analysisId), JSON.stringify(state), "EX", ttl)
      .set(this.snapshotKey(state.snapshotHash), state.analysisId, "EX", roastPipelineConfig.cache.snapshotTtlSec)
      .exec();
  }

  async appendLog(analysisId: string, message: string) {
    const current = await this.getByAnalysisId(analysisId);
    if (!current) {
      return;
    }

    current.logs.push(message);
    await this.save(current);
  }

  async clear() {
    await this.redis.connect().catch(() => undefined);
    const keys = await this.redis.keys("slc:analysis:*");
    const snapshotKeys = await this.redis.keys("slc:snapshot:*");
    if (keys.length + snapshotKeys.length > 0) {
      await this.redis.del(...keys, ...snapshotKeys);
    }
  }
}
