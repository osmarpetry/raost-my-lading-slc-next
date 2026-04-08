import { setTimeout as sleep } from "node:timers/promises";

import { load as loadHtml } from "cheerio";

import type { ScanFinding, ScanJob } from "@/lib/shared/scans";
import { qualityBandForScore } from "@/lib/shared/scans";
import { runLighthouseAudit } from "@/server/lighthouse";
import { streamOllamaText } from "@/server/ollama";
import { scanManager } from "@/server/runtime";

interface PageSummary {
  pageKind: "HOMEPAGE" | "INTERNAL";
  url: string;
  statusCode: number;
  ok: boolean;
  contentType: string | null;
  title: string | null;
  h1: string | null;
  wordCount: number;
  snippet: string | null;
}

interface ExternalLinkSummary {
  targetUrl: string;
  loaded: boolean;
  finalUrl: string | null;
  pageTitle: string | null;
}

interface CrawlResult {
  pages: PageSummary[];
  externalLinks: ExternalLinkSummary[];
}

interface ScanRuntimeDependencies {
  fetchImpl?: typeof fetch;
  sleepMs?: typeof sleep;
  runLighthouse?: typeof runLighthouseAudit;
  streamText?: typeof streamOllamaText;
}

function cleanText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function isHtmlContentType(contentType: string | null) {
  return contentType ? contentType.toLowerCase().includes("text/html") : false;
}

async function fetchText(url: string, fetchImpl: typeof fetch) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12_000);

  try {
    const response = await fetchImpl(url, {
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "user-agent": "slc-next/0.1",
      },
    });

    return {
      finalUrl: response.url,
      statusCode: response.status,
      ok: response.ok,
      contentType: response.headers.get("content-type"),
      html: await response.text(),
    };
  } finally {
    clearTimeout(timer);
  }
}

function extractPage(
  response: {
    finalUrl: string;
    statusCode: number;
    ok: boolean;
    contentType: string | null;
    html: string;
  },
  pageKind: "HOMEPAGE" | "INTERNAL",
): PageSummary {
  const htmlLike = isHtmlContentType(response.contentType);
  const $ = loadHtml(htmlLike ? response.html : "");
  $("script, style, noscript, svg").remove();

  const bodyText = htmlLike ? cleanText($("body").text()) : cleanText(response.html);

  return {
    url: response.finalUrl,
    pageKind,
    statusCode: response.statusCode,
    ok: response.ok,
    contentType: response.contentType,
    title: cleanText($("title").first().text()) || null,
    h1: cleanText($("h1").first().text()) || null,
    wordCount: bodyText ? bodyText.split(/\s+/).length : 0,
    snippet: bodyText ? bodyText.slice(0, 260) : null,
  };
}

function collectLinks(html: string, baseUrl: string) {
  const $ = loadHtml(html);
  const base = new URL(baseUrl);
  const internal = new Set<string>();
  const external = new Set<string>();

  $("a[href]").each((_index, element) => {
    const href = $(element).attr("href");
    if (!href) {
      return;
    }

    try {
      const resolved = new URL(href, baseUrl);
      if (!["http:", "https:"].includes(resolved.protocol)) {
        return;
      }

      resolved.hash = "";

      if (resolved.origin === base.origin) {
        internal.add(resolved.toString());
      } else {
        external.add(resolved.toString());
      }
    } catch {
      // ignore malformed hrefs
    }
  });

  internal.delete(base.toString());

  return {
    internal: [...internal],
    external: [...external],
  };
}

async function inspectExternalLink(url: string, fetchImpl: typeof fetch): Promise<ExternalLinkSummary> {
  try {
    const response = await fetchImpl(url, {
      redirect: "follow",
      headers: {
        "user-agent": "slc-next/0.1",
      },
    });

    const body = response.ok ? await response.text() : "";
    const $ = loadHtml(body);

    return {
      targetUrl: url,
      loaded: response.ok,
      finalUrl: response.url,
      pageTitle: cleanText($("title").first().text()) || null,
    };
  } catch {
    return {
      targetUrl: url,
      loaded: false,
      finalUrl: null,
      pageTitle: null,
    };
  }
}

async function crawlSite(
  normalizedUrl: string,
  fetchImpl: typeof fetch,
): Promise<CrawlResult> {
  const homepageResponse = await fetchText(normalizedUrl, fetchImpl);
  const homepage = extractPage(homepageResponse, "HOMEPAGE");
  const links = isHtmlContentType(homepageResponse.contentType)
    ? collectLinks(homepageResponse.html, homepageResponse.finalUrl)
    : { internal: [], external: [] };

  const internalPages: PageSummary[] = [];
  for (const url of links.internal.slice(0, 1)) {
    try {
      const response = await fetchText(url, fetchImpl);
      internalPages.push(extractPage(response, "INTERNAL"));
    } catch {
      // skip unreachable internal pages
    }
  }

  const externalLinks: ExternalLinkSummary[] = [];
  for (const url of links.external.slice(0, 2)) {
    externalLinks.push(await inspectExternalLink(url, fetchImpl));
  }

  return {
    pages: [homepage, ...internalPages],
    externalLinks,
  };
}

function buildFindings(scan: ScanJob, crawl: CrawlResult, score: number): ScanFinding[] {
  const homepage = crawl.pages[0];
  const findings: ScanFinding[] = [];

  if (homepage && !homepage.ok) {
    findings.push({
      code: "HOMEPAGE_STATUS",
      severity: homepage.statusCode >= 500 ? "CRITICAL" : "HIGH",
      title: `Homepage responds with HTTP ${homepage.statusCode}`,
      roastLine: `The target URL is reachable, but it is serving an error response instead of a usable landing page.`,
      fix: "Restore a valid HTML response at the submitted URL before trusting any conversion analysis.",
    });
  }

  if (!homepage?.h1) {
    findings.push({
      code: "H1_MISSING",
      severity: "HIGH",
      title: "Headline does not anchor the promise",
      roastLine: "The hero makes the visitor do the translation work.",
      fix: "Lead with one concrete payoff in the first heading.",
    });
  }

  if ((homepage?.wordCount ?? 0) < 120) {
    findings.push({
      code: "TOO_THIN",
      severity: "MEDIUM",
      title: "Homepage signal is too thin",
      roastLine: "There is not enough substance above the fold to justify trust.",
      fix: "Add clearer proof, product specifics, or examples before the first scroll.",
    });
  }

  if (crawl.externalLinks.every((link) => !link.loaded)) {
    findings.push({
      code: "PROOF_WEAK",
      severity: "HIGH",
      title: "Credibility links are weak or missing",
      roastLine: "Trust is claimed, not demonstrated.",
      fix: "Show accessible proof links, case studies, or third-party validation.",
    });
  }

  findings.push({
    code: "QUALITY_SCORE",
    severity: score >= 70 ? "LOW" : "MEDIUM",
    title: "Quality score needs stronger polish",
    roastLine: `Current score lands at ${score}/100. The page is serviceable but still leaks confidence.`,
    fix: "Tighten copy, hierarchy, and trust cues before increasing acquisition spend.",
  });

  return findings.slice(0, 4);
}

function buildTemplateSignals(crawl: CrawlResult) {
  const homepage = crawl.pages[0];
  return [
    homepage ? `Homepage HTTP status: ${homepage.statusCode}` : "Homepage HTTP status unknown",
    homepage?.contentType ? `Content type: ${homepage.contentType}` : "Content type unknown",
    homepage?.title ? `Title present: ${homepage.title}` : "Title missing",
    homepage?.h1 ? `Headline present: ${homepage.h1}` : "Headline missing",
    `Word count: ${homepage?.wordCount ?? 0}`,
    `External proof links loaded: ${crawl.externalLinks.filter((entry) => entry.loaded).length}/${crawl.externalLinks.length}`,
  ].join(". ");
}

function buildFinalVerdict(scan: ScanJob, crawl: CrawlResult, score: number) {
  const homepage = crawl.pages[0];
  const band = qualityBandForScore(score);
  const title = homepage?.title ?? "Untitled page";
  const headline = homepage?.h1 ?? "No clear headline";

  if (homepage && !homepage.ok) {
    return `The submitted URL is returning HTTP ${homepage.statusCode}, so the landing page is failing before the pitch even begins. Right now the strongest signal is operational breakage, not positioning. Fix the response at ${homepage.url}, make sure it serves a real HTML page, then rerun the scan for meaningful conversion feedback.`;
  }

  return `${title} is landing in ${band.toLowerCase()} territory at ${score}/100. The page opens with "${headline}", but the promise still needs sharper payoff and faster proof. Tighten the headline, move concrete evidence higher, and cut any copy that asks the visitor to infer the value on their own.`;
}

function previewRoast(text: string) {
  const sentence = text.split(". ").at(0)?.trim() ?? text.trim();
  return sentence.length > 160 ? `${sentence.slice(0, 157)}...` : sentence;
}

async function appendChunkEvent(
  scanId: string,
  text: string,
  extraPayload: Record<string, unknown> = {},
) {
  scanManager.appendEvent(scanId, "LLM_CHUNK", "OLLAMA", "Streaming roast text", {
    ...extraPayload,
    textDelta: text,
  });
}

export async function runScanJob(
  scanId: string,
  deps: ScanRuntimeDependencies = {},
) {
  const fetchImpl = deps.fetchImpl ?? fetch;
  const pause = deps.sleepMs ?? sleep;
  const runLighthouse = deps.runLighthouse ?? runLighthouseAudit;
  const streamText = deps.streamText ?? streamOllamaText;

  await scanManager.runScan(scanId, async ({ appendEvent, getScan, updateScan }) => {
    const scan = getScan();
    appendEvent("SCAN_STAGE", "RUNNING", "Scan started");
    appendEvent("SCAN_STAGE", "CRAWLING", "Fetching homepage and links");

    const crawl = await crawlSite(scan.normalizedUrl ?? scan.url ?? "", fetchImpl);

    for (const page of crawl.pages) {
      appendEvent("PAGE_SCANNED", "CRAWLING", "Page scanned", {
        url: page.url,
        pageKind: page.pageKind,
        statusCode: page.statusCode,
        ok: page.ok,
      });
    }

    for (const link of crawl.externalLinks) {
      appendEvent("EXTERNAL_LINK_CHECKED", "CRAWLING", "External link inspected", {
        url: link.targetUrl,
        loaded: link.loaded,
      });
    }

    appendEvent("SCAN_STAGE", "QUALITY", "Running Lighthouse", {
      flushStream: true,
    });
    const quality = await runLighthouse(scan.normalizedUrl ?? scan.url ?? "");
    appendEvent("SCAN_STAGE", "QUALITY", `Score ${quality.score}/100 (${quality.band})`, {
      flushStream: true,
    });

    for (let index = 0; index < crawl.externalLinks.length; index += 1) {
      const link = crawl.externalLinks[index];
      appendEvent("SCAN_STAGE", "OLLAMA", `Checking link ${index + 1}/${crawl.externalLinks.length}`, {
        flushStream: true,
      });

      const fallback = link.loaded
        ? `Link ${index + 1} looks reachable and contributes some trust, but it still needs clearer context from the landing page.`
        : `Link ${index + 1} does not resolve cleanly. That is a trust leak visitors can feel immediately.`;

      await streamText({
        prompt: `Review the trust signal for ${link.targetUrl} from ${scan.normalizedUrl}.`,
        fallback,
        onText: (chunk) => appendChunkEvent(scan.id, chunk, { field: "analysis" }),
        fetchImpl,
      });
    }

    appendEvent("SCAN_STAGE", "OLLAMA", "Checking template signals", {
      flushStream: true,
    });

    await streamText({
      prompt: `Summarize the landing page template signals for ${scan.normalizedUrl}. ${buildTemplateSignals(crawl)}`,
      fallback: buildTemplateSignals(crawl),
      onText: (chunk) => appendChunkEvent(scan.id, chunk, { field: "analysis" }),
      fetchImpl,
    });

    const verdict = buildFinalVerdict(scan, crawl, quality.score);
    appendEvent("SCAN_STAGE", "OLLAMA", "Writing final verdict", {
      flushStream: true,
    });

    await streamText({
      prompt: `Write a direct landing page verdict for ${scan.normalizedUrl}.`,
      fallback: verdict,
      onText: (chunk) =>
        appendChunkEvent(scan.id, chunk, {
          field: "finalVerdict",
          step: "finalVerdict",
          band: quality.band,
        }),
      fetchImpl,
    });

    const findings = buildFindings(scan, crawl, quality.score);

    updateScan((entry) => {
      entry.previewRoast = previewRoast(verdict);
      entry.fullRoast = verdict;
      entry.qualityScore = quality.score;
      entry.qualityBand = quality.band;
      entry.lighthouse = quality.lighthouse;
      entry.findings = findings;
    });

    appendEvent("FINDINGS_READY", "PERSIST_FINDINGS", "Findings persisted", {
      count: findings.length,
      flushStream: true,
    });

    await pause(40);
    appendEvent("JOB_COMPLETED", "COMPLETED", "Scan completed");
  });
}
