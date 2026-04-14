import { load as loadHtml } from "cheerio";

import type {
  ExternalLinkSummary,
  PageContentSnapshot,
  RouteMapSummary,
} from "@/lib/shared/scans";
import { roastPipelineConfig } from "@/server/config/roast-pipeline-config";

function cleanText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function isHtmlContentType(contentType: string | null) {
  return contentType ? contentType.toLowerCase().includes("text/html") : false;
}

async function fetchText(url: string, fetchImpl: typeof fetch) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), roastPipelineConfig.crawl.fetchTimeoutMs);

  try {
    const response = await fetchImpl(url, {
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "user-agent": "roast-my-landing/0.1",
      },
    });

    return {
      finalUrl: response.url || url,
      statusCode: response.status,
      ok: response.ok,
      contentType: response.headers.get("content-type"),
      html: await response.text(),
    };
  } finally {
    clearTimeout(timer);
  }
}

function scorePageRelevance(url: string, homepageUrl: string) {
  const pathname = new URL(url).pathname.toLowerCase();
  if (url === homepageUrl || pathname === "/") {
    return 100;
  }

  const priorities = [
    "/about",
    "/services",
    "/pricing",
    "/portfolio",
    "/case-studies",
    "/cases",
    "/contact",
    "/articles",
    "/blog",
  ];

  const matchIndex = priorities.findIndex((entry) => pathname.includes(entry));
  if (matchIndex >= 0) {
    return 90 - matchIndex;
  }

  return 25;
}

function collectLinks(html: string, baseUrl: string) {
  const $ = loadHtml(html);
  const base = new URL(baseUrl);
  const internal = new Set<string>();
  const external = new Map<string, ExternalLinkSummary>();

  $("a[href]").each((_index, element) => {
    const href = $(element).attr("href");
    if (!href) {
      return;
    }

    try {
      const resolved = new URL(href, baseUrl);
      resolved.hash = "";
      if (!["http:", "https:"].includes(resolved.protocol)) {
        return;
      }

      if (resolved.origin === base.origin) {
        internal.add(resolved.toString());
        return;
      }

      if (!external.has(resolved.toString())) {
        external.set(resolved.toString(), {
          sourceUrl: baseUrl,
          targetUrl: resolved.toString(),
          label: cleanText($(element).text()) || null,
        });
      }
    } catch {
      // ignore invalid href
    }
  });

  internal.delete(base.toString());

  return {
    internal: [...internal]
      .sort(
        (left, right) =>
          scorePageRelevance(right, base.toString()) - scorePageRelevance(left, base.toString()),
      )
      .slice(0, roastPipelineConfig.crawl.maxInternalLinksPerPage),
    external: [...external.values()],
  };
}

function extractPageContent(
  response: {
    finalUrl: string;
    statusCode: number;
    ok: boolean;
    contentType: string | null;
    html: string;
  },
  pageKind: "HOMEPAGE" | "INTERNAL",
): PageContentSnapshot {
  const htmlLike = isHtmlContentType(response.contentType);
  const $ = loadHtml(htmlLike ? response.html : "");
  $("script, style, noscript, svg").remove();

  const links = htmlLike ? collectLinks(response.html, response.finalUrl) : { internal: [], external: [] };
  const title = cleanText($("title").first().text()) || null;
  const metaDescription = cleanText($('meta[name="description"]').attr("content") ?? "") || null;
  const h1 = cleanText($("h1").first().text()) || null;
  const headings = $("h1, h2, h3")
    .map((_index, element) => cleanText($(element).text()))
    .get()
    .filter(Boolean)
    .slice(0, 12);
  const ctaTexts = $("a, button")
    .map((_index, element) => cleanText($(element).text()))
    .get()
    .filter((entry) => entry.length > 0 && entry.length <= 120)
    .slice(0, 12);
  const navLabels = $("nav a")
    .map((_index, element) => cleanText($(element).text()))
    .get()
    .filter(Boolean)
    .slice(0, 12);
  const footerTrustItems = $("footer a, footer p, footer li")
    .map((_index, element) => cleanText($(element).text()))
    .get()
    .filter(Boolean)
    .slice(0, 10);
  const text = cleanText($("body").text());
  const sections = $("section, article, div")
    .map((_index, element) => cleanText($(element).text()))
    .get()
    .filter((entry) => entry.length >= 30);
  const heroText = sections[0] ?? h1 ?? title;
  const proofBlocks = sections.filter((entry) => /case|client|testimonial|result|trusted|experience|customers?/i.test(entry)).slice(0, 6);
  const pricingBlocks = sections.filter((entry) => /pricing|trial|month|annual|price|plan/i.test(entry)).slice(0, 4);
  const testimonials = sections.filter((entry) => /testimonial|review|said|quote|customer/i.test(entry)).slice(0, 4);

  return {
    url: response.finalUrl,
    pageKind,
    statusCode: response.statusCode,
    ok: response.ok,
    contentType: response.contentType,
    title,
    metaDescription,
    h1,
    headings,
    heroText,
    ctaTexts,
    proofBlocks,
    pricingBlocks,
    testimonials,
    navLabels,
    footerTrustItems,
    externalLinks: links.external,
    snippet: text.slice(0, 260) || null,
    text,
  };
}

export async function fetchPrimaryPages(normalizedUrl: string, fetchImpl: typeof fetch = fetch) {
  const homepageResponse = await fetchText(normalizedUrl, fetchImpl);
  const homepage = extractPageContent(homepageResponse, "HOMEPAGE");
  const homepageLinks = isHtmlContentType(homepageResponse.contentType)
    ? collectLinks(homepageResponse.html, homepageResponse.finalUrl)
    : { internal: [], external: [] };

  const pages: PageContentSnapshot[] = [homepage];
  const externalLinks: ExternalLinkSummary[] = [...homepageLinks.external];

  for (const url of homepageLinks.internal.slice(0, roastPipelineConfig.crawl.maxPages - 1)) {
    try {
      const response = await fetchText(url, fetchImpl);
      const page = extractPageContent(response, "INTERNAL");
      pages.push(page);
      externalLinks.push(...page.externalLinks);
    } catch {
      // skip unreachable internal pages
    }
  }

  const routeMap: RouteMapSummary = {
    rootUrl: homepageResponse.finalUrl,
    scannedUrls: pages.map((page) => page.url),
    childUrls: homepageLinks.internal.slice(0, roastPipelineConfig.crawl.maxPages - 1),
  };

  return {
    rootUrl: homepageResponse.finalUrl,
    routeMap,
    pages,
    externalLinks,
  };
}
