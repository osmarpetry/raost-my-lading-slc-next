function optionalNumber(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function normalizeProvider(value: string | undefined) {
  return value === "pagespeed" ? "pagespeed" : "local";
}

export function getServerEnv() {
  return {
    nodeEnv: process.env.NODE_ENV ?? "development",
    app: {
      port: optionalNumber(process.env.PORT, 3000),
    },
    openai: {
      apiKey: process.env.OPENAI_API_KEY ?? "",
      baseUrl: process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1",
      model: process.env.OPENAI_MODEL ?? "gpt-5.4-nano",
      timeoutMs: optionalNumber(process.env.OPENAI_TIMEOUT_MS, 25_000),
    },
    lighthouse: {
      provider: normalizeProvider(process.env.LIGHTHOUSE_PROVIDER),
      timeoutMs: optionalNumber(process.env.LIGHTHOUSE_TIMEOUT_MS, 60_000),
      chromePath: process.env.CHROME_PATH ?? "",
      allowProviderFallback: process.env.ALLOW_PROVIDER_FALLBACK === "true",
    },
    pagespeed: {
      apiKey: process.env.PAGESPEED_API_KEY ?? "",
      strategy: process.env.PAGESPEED_STRATEGY === "desktop" ? "desktop" : "mobile",
      timeoutMs: optionalNumber(process.env.PAGESPEED_TIMEOUT_MS, 25_000),
    },
    redis: {
      url: process.env.REDIS_URL ?? "",
    },
    postgres: {
      url: process.env.POSTGRES_URL ?? "",
    },
  } as const;
}
