import * as chromeLauncher from "chrome-launcher";
import { existsSync } from "node:fs";

import type {
  LighthouseProfile,
  LighthouseProviderStatus,
  LighthouseSnapshot,
  QualityBand,
} from "@/lib/shared/scans";
import { qualityBandForScore } from "@/lib/shared/scans";
import { getServerEnv } from "@/server/config/env";
import { runPageSpeedAudit } from "@/server/providers/pagespeed/client";

export interface LighthouseRunResult {
  profiles: {
    mobile: LighthouseProfile | null;
    desktop: LighthouseProfile | null;
  };
  qualityScore: number;
  qualityBand: QualityBand;
  raw: {
    mobile: Record<string, unknown> | null;
    desktop: Record<string, unknown> | null;
  };
  status: LighthouseProviderStatus;
}

const COMMON_CHROME_PATHS = [
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary",
  "/usr/bin/google-chrome",
  "/usr/bin/google-chrome-stable",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
  "/usr/local/bin/google-chrome",
  "/usr/local/bin/chromium",
  "/opt/google/chrome/google-chrome",
];

function findChromePath(preferredPath: string | undefined): string {
  if (preferredPath && existsSync(preferredPath)) {
    return preferredPath;
  }

  for (const candidate of COMMON_CHROME_PATHS) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }

  throw new Error("SCAN FAILED · Chrome/Chromium not found");
}

function normalizeCategoryScore(value: unknown): number | null {
  if (typeof value !== "number") {
    return null;
  }
  return Math.max(0, Math.min(100, Math.round(value * 100)));
}

function buildSnapshot(
  raw: Record<string, unknown>,
  strategy: "mobile" | "desktop",
  source: "local" | "pagespeed",
): LighthouseSnapshot {
  const categories = (raw.categories ?? {}) as Record<
    string,
    { score?: number }
  >;

  return {
    performance: normalizeCategoryScore(categories.performance?.score),
    accessibility: normalizeCategoryScore(categories.accessibility?.score),
    bestPractices: normalizeCategoryScore(categories["best-practices"]?.score),
    seo: normalizeCategoryScore(categories.seo?.score),
    strategy,
    source,
    fetchedAt: new Date().toISOString(),
  };
}

function averageScores(snapshot: LighthouseSnapshot): number {
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

function buildProfile(snapshot: LighthouseSnapshot): LighthouseProfile {
  const score = averageScores(snapshot);
  return {
    score,
    band: qualityBandForScore(score),
    snapshot,
  };
}

async function runLocalLighthouse(
  targetUrl: string,
): Promise<LighthouseRunResult> {
  const env = getServerEnv();
  const chromePath = findChromePath(env.lighthouse.chromePath || undefined);
  const startedAt = Date.now();

  let chrome: chromeLauncher.LaunchedChrome | undefined;

  try {
    const [{ default: lighthouse }, { default: desktopConfig }] = await Promise.all([
      import("lighthouse"),
      import("lighthouse/core/config/desktop-config.js"),
    ]);

    chrome = await chromeLauncher.launch({
      chromeFlags: ["--headless", "--disable-gpu", "--no-sandbox"],
      chromePath,
    });

    const port = chrome.port;

    const mobileRunner = await lighthouse(targetUrl, {
      logLevel: "error",
      output: "json",
      port,
    });

    const desktopRunner = await lighthouse(
      targetUrl,
      {
        logLevel: "error",
        output: "json",
        port,
      },
      desktopConfig,
    );

    if (!mobileRunner?.lhr || !desktopRunner?.lhr) {
      throw new Error("Lighthouse returned empty result");
    }

    const mobileRaw = mobileRunner.lhr as unknown as Record<string, unknown>;
    const desktopRaw = desktopRunner.lhr as unknown as Record<string, unknown>;

    const mobileSnapshot = buildSnapshot(mobileRaw, "mobile", "local");
    const desktopSnapshot = buildSnapshot(desktopRaw, "desktop", "local");

    const mobileProfile = buildProfile(mobileSnapshot);
    const desktopProfile = buildProfile(desktopSnapshot);
    const qualityScore = Math.round((mobileProfile.score + desktopProfile.score) / 2);

    return {
      profiles: {
        mobile: mobileProfile,
        desktop: desktopProfile,
      },
      qualityScore,
      qualityBand: qualityBandForScore(qualityScore),
      raw: {
        mobile: mobileRaw,
        desktop: desktopRaw,
      },
      status: {
        provider: "lighthouse",
        source: "local",
        reason: "Local Lighthouse completed",
        latencyMs: Date.now() - startedAt,
      },
    };
  } catch (error) {
    const reason = error instanceof Error ? error.message : "Local Lighthouse failed";
    throw Object.assign(new Error(reason), {
      status: {
        provider: "lighthouse",
        source: "failed",
        reason,
        latencyMs: Date.now() - startedAt,
      } satisfies LighthouseProviderStatus,
    });
  } finally {
    chrome?.kill();
  }
}

async function runPageSpeedLighthouse(
  targetUrl: string,
): Promise<LighthouseRunResult> {
  const startedAt = Date.now();

  try {
    const [mobileResult, desktopResult] = await Promise.all([
      runPageSpeedAudit(targetUrl, "mobile"),
      runPageSpeedAudit(targetUrl, "desktop"),
    ]);

    const qualityScore = Math.round(
      (mobileResult.profile.score + desktopResult.profile.score) / 2,
    );

    return {
      profiles: {
        mobile: mobileResult.profile,
        desktop: desktopResult.profile,
      },
      qualityScore,
      qualityBand: qualityBandForScore(qualityScore),
      raw: {
        mobile: mobileResult.raw,
        desktop: desktopResult.raw,
      },
      status: {
        provider: "lighthouse",
        source: "pagespeed",
        reason: "PageSpeed audit completed",
        latencyMs: Date.now() - startedAt,
      },
    };
  } catch (error) {
    const reason = error instanceof Error ? error.message : "PageSpeed audit failed";
    throw Object.assign(new Error(reason), {
      status: {
        provider: "lighthouse",
        source: "failed",
        reason,
        latencyMs: Date.now() - startedAt,
      } satisfies LighthouseProviderStatus,
    });
  }
}

export async function runLighthouseAudit(
  targetUrl: string,
): Promise<LighthouseRunResult> {
  const env = getServerEnv();

  if (env.lighthouse.provider === "pagespeed") {
    return runPageSpeedLighthouse(targetUrl);
  }

  return runLocalLighthouse(targetUrl);
}
