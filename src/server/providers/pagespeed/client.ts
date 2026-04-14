import type {
  LighthouseProfile,
  LighthouseProviderStatus,
  LighthouseSnapshot,
  QualityBand,
} from "@/lib/shared/scans";
import { qualityBandForScore } from "@/lib/shared/scans";
import { getServerEnv } from "@/server/config/env";

export interface PageSpeedAuditResult {
  profile: LighthouseProfile;
  raw: Record<string, unknown>;
  status: LighthouseProviderStatus;
}

function createStatus(
  source: LighthouseProviderStatus["source"],
  reason: string,
  latencyMs?: number,
): LighthouseProviderStatus {
  return {
    provider: "lighthouse",
    source,
    reason,
    latencyMs: latencyMs ?? null,
  };
}

function averageScores(snapshot: LighthouseSnapshot) {
  const values = [
    snapshot.performance,
    snapshot.accessibility,
    snapshot.bestPractices,
    snapshot.seo,
  ].filter((value): value is number => typeof value === "number");

  if (values.length === 0) {
    return 0;
  }

  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function normalizeCategoryScore(value: unknown) {
  if (typeof value !== "number") {
    return null;
  }

  return Math.max(0, Math.min(100, Math.round(value * 100)));
}

function buildProfile(snapshot: LighthouseSnapshot): LighthouseProfile {
  const score = averageScores(snapshot);
  const band: QualityBand = qualityBandForScore(score);

  return {
    score,
    band,
    snapshot,
  };
}

export async function runPageSpeedAudit(
  targetUrl: string,
  strategy: "mobile" | "desktop",
): Promise<PageSpeedAuditResult> {
  const env = getServerEnv();
  const startedAt = Date.now();
  const url = new URL("https://www.googleapis.com/pagespeedonline/v5/runPagespeed");
  url.searchParams.set("url", targetUrl);
  url.searchParams.set("strategy", strategy);
  url.searchParams.set("category", "performance");
  url.searchParams.set("category", "accessibility");
  url.searchParams.set("category", "best-practices");
  url.searchParams.set("category", "seo");
  if (env.pagespeed.apiKey) {
    url.searchParams.set("key", env.pagespeed.apiKey);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), env.pagespeed.timeoutMs);

  try {
    const response = await fetch(url.toString(), {
      headers: {
        "user-agent": "roast-my-landing/0.1",
      },
      signal: controller.signal,
    }).finally(() => clearTimeout(timer));

    if (!response.ok) {
      throw new Error(`PageSpeed request failed with ${response.status}`);
    }

    const payload = (await response.json()) as {
      lighthouseResult?: {
        categories?: Record<
          string,
          {
            score?: number;
          }
        >;
      };
    };

    const categories = payload.lighthouseResult?.categories;
    if (!categories) {
      throw new Error("PageSpeed categories missing");
    }

    const snapshot: LighthouseSnapshot = {
      performance: normalizeCategoryScore(categories.performance?.score),
      accessibility: normalizeCategoryScore(categories.accessibility?.score),
      bestPractices: normalizeCategoryScore(categories["best-practices"]?.score),
      seo: normalizeCategoryScore(categories.seo?.score),
      strategy,
      source: "pagespeed",
      fetchedAt: new Date().toISOString(),
    };

    return {
      profile: buildProfile(snapshot),
      raw: payload as Record<string, unknown>,
      status: createStatus("pagespeed", "PageSpeed audit completed", Date.now() - startedAt),
    };
  } catch (error) {
    const reason = error instanceof Error ? error.message : "PageSpeed audit failed";
    throw Object.assign(new Error(reason), {
      status: createStatus("failed", reason, Date.now() - startedAt),
    });
  }
}
