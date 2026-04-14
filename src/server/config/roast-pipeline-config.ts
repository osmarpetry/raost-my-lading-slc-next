export const roastPipelineConfig = {
  crawl: {
    maxPages: 5,
    maxInternalLinksPerPage: 10,
    fetchTimeoutMs: 12_000,
  },
  cache: {
    checkpointTtlSec: 60 * 60 * 24,
    snapshotTtlSec: 60 * 60 * 24 * 30,
    traceTtlSec: 60 * 60 * 24 * 7,
  },
  scoring: {
    promptPackStep: 5,
  },
  finalOutput: {
    complimentsCount: 3,
    priorityFixesCount: 3,
    quickWinsMax: 3,
  },
  model: {
    default: "gpt-5.4-nano",
    fallback: "gpt-5-nano",
    maxOutputTokens: 650,
  },
} as const;

export type RoastPipelineConfig = typeof roastPipelineConfig;
