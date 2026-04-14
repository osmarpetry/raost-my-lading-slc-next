import type { OpenAiProviderStatus } from "@/lib/shared/scans";
import { getServerEnv } from "@/server/config/env";

interface StreamTextOptions {
  system: string;
  prompt: string;
  onText: (chunk: string) => Promise<void> | void;
}

interface OpenAiMessage {
  role: "system" | "user";
  content: string;
}

export class OpenAiProviderError extends Error {
  constructor(
    message: string,
    readonly status: OpenAiProviderStatus,
  ) {
    super(message);
    this.name = "OpenAiProviderError";
  }
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function createHeaders(apiKey: string) {
  return {
    "content-type": "application/json",
    authorization: `Bearer ${apiKey}`,
  };
}

function parseSseDelta(line: string) {
  if (!line.startsWith("data:")) {
    return "";
  }

  const raw = line.slice(5).trim();
  if (!raw || raw === "[DONE]") {
    return "";
  }

  try {
    const parsed = JSON.parse(raw) as {
      choices?: Array<{
        delta?: {
          content?: string;
        };
      }>;
    };
    return parsed.choices?.[0]?.delta?.content ?? "";
  } catch {
    return "";
  }
}

function disabledStatus(reason: string): OpenAiProviderStatus {
  const env = getServerEnv();
  return {
    provider: "openai",
    source: "disabled",
    reason,
    model: env.openai.model,
    latencyMs: null,
  };
}

function failedStatus(reason: string, latencyMs: number): OpenAiProviderStatus {
  const env = getServerEnv();
  return {
    provider: "openai",
    source: "failed",
    reason,
    model: env.openai.model,
    latencyMs,
  };
}

export async function streamOpenAiText({
  system,
  prompt,
  onText,
}: StreamTextOptions) {
  const env = getServerEnv();

  if (!env.openai.apiKey) {
    throw new OpenAiProviderError("OPENAI_API_KEY missing", disabledStatus("OPENAI_API_KEY missing"));
  }

  const startedAt = Date.now();

  try {
    const response = await fetchWithTimeout(
      `${env.openai.baseUrl}/chat/completions`,
      {
        method: "POST",
        headers: createHeaders(env.openai.apiKey),
        body: JSON.stringify({
          model: env.openai.model,
          stream: true,
          messages: [
            {
              role: "system",
              content: system,
            } satisfies OpenAiMessage,
            {
              role: "user",
              content: prompt,
            } satisfies OpenAiMessage,
          ],
        }),
      },
      env.openai.timeoutMs,
    );

    if (!response.ok || !response.body) {
      throw new Error(`OpenAI stream failed with ${response.status}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let fullText = "";

    while (true) {
      const { value, done } = await reader.read();
      if (done) {
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        const delta = parseSseDelta(line.trim());
        if (!delta) {
          continue;
        }

        fullText += delta;
        await onText(delta);
      }
    }

    const text = fullText.trim();
    if (!text) {
      throw new Error("OpenAI stream produced no text");
    }

    return {
      text,
      status: {
        provider: "openai" as const,
        source: "live" as const,
        reason: "OpenAI final synthesis completed",
        model: env.openai.model,
        latencyMs: Date.now() - startedAt,
      },
    };
  } catch (error) {
    if (error instanceof OpenAiProviderError) {
      throw error;
    }

    const reason = error instanceof Error ? error.message : "OpenAI stream failed";
    throw new OpenAiProviderError(reason, failedStatus(reason, Date.now() - startedAt));
  }
}
