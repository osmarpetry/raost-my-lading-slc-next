import {
  qualityBandForScore,
  type LighthouseSnapshot,
  type QualityBand,
} from "@/lib/shared/scans";

interface LighthouseResult {
  lighthouse: LighthouseSnapshot;
  score: number;
  band: QualityBand;
  didFallback: boolean;
}

interface RunLighthouseAuditOptions {
  timeoutMs?: number;
  execute?: (targetUrl: string) => Promise<LighthouseSnapshot>;
}

const neutralSnapshot: LighthouseSnapshot = {
  performance: 55,
  accessibility: 72,
  bestPractices: 68,
  seo: 70,
};

function averageScores(snapshot: LighthouseSnapshot) {
  const values = [
    snapshot.performance ?? 0,
    snapshot.accessibility ?? 0,
    snapshot.bestPractices ?? 0,
    snapshot.seo ?? 0,
  ];

  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number) {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error("Lighthouse timed out"));
    }, timeoutMs);

    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
  });
}

async function defaultExecute() {
  return neutralSnapshot;
}

export async function runLighthouseAudit(
  targetUrl: string,
  options: RunLighthouseAuditOptions = {},
): Promise<LighthouseResult> {
  const timeoutMs = options.timeoutMs ?? 30_000;
  const execute = options.execute ?? defaultExecute;

  try {
    const lighthouse = await withTimeout(execute(targetUrl), timeoutMs);
    const score = averageScores(lighthouse);
    return {
      lighthouse,
      score,
      band: qualityBandForScore(score),
      didFallback: false,
    };
  } catch {
    const score = averageScores(neutralSnapshot);
    return {
      lighthouse: neutralSnapshot,
      score,
      band: qualityBandForScore(score),
      didFallback: true,
    };
  }
}
