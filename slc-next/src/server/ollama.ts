import { setTimeout as sleep } from "node:timers/promises";

interface StreamOllamaTextOptions {
  prompt: string;
  fallback: string;
  onText: (chunk: string) => Promise<void> | void;
  fetchImpl?: typeof fetch;
  model?: string;
  baseUrl?: string;
}

export function chunkText(text: string, chunkSize = 64) {
  const chunks: string[] = [];

  for (let index = 0; index < text.length; index += chunkSize) {
    chunks.push(text.slice(index, index + chunkSize));
  }

  return chunks;
}

export function parseOllamaNdjson(source: string) {
  const deltas: string[] = [];
  let done = false;

  for (const line of source
    .split("\n")
    .map((entry) => entry.trim())
    .filter(Boolean)) {
    const parsed = JSON.parse(line) as { response?: string; done?: boolean };
    if (typeof parsed.response === "string" && parsed.response.length > 0) {
      deltas.push(parsed.response);
    }

    if (parsed.done === true) {
      done = true;
    }
  }

  return { deltas, done };
}

export async function emitTextChunks(
  text: string,
  onText: (chunk: string) => Promise<void> | void,
  pauseMs = 40,
) {
  for (const chunk of chunkText(text, 64)) {
    await onText(chunk);
    await sleep(pauseMs);
  }
}

export async function streamOllamaText({
  prompt,
  fallback,
  onText,
  fetchImpl = fetch,
  model = process.env.OLLAMA_MODEL ?? "qwen3.5:35b-a3b",
  baseUrl = process.env.OLLAMA_BASE_URL ?? "http://127.0.0.1:11434",
}: StreamOllamaTextOptions) {
  const timeoutMs = Number(process.env.OLLAMA_TIMEOUT_MS ?? "30000");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetchImpl(`${baseUrl}/api/generate`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      signal: controller.signal,
      body: JSON.stringify({
        model,
        prompt,
        stream: true,
      }),
    });

    clearTimeout(timer);

    if (!response.ok || !response.body) {
      throw new Error("Ollama unavailable");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let fullText = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }

      buffer += decoder.decode(value, { stream: true });

      const segments = buffer.split("\n");
      buffer = segments.pop() ?? "";

      for (const segment of segments) {
        if (!segment.trim()) {
          continue;
        }

        const parsed = parseOllamaNdjson(segment);
        for (const delta of parsed.deltas) {
          fullText += delta;
          await onText(delta);
        }
      }
    }

    if (buffer.trim()) {
      const parsed = parseOllamaNdjson(buffer);
      for (const delta of parsed.deltas) {
        fullText += delta;
        await onText(delta);
      }
    }

    if (fullText.trim()) {
      return fullText.trim();
    }
  } catch {
    clearTimeout(timer);
    // deterministic fallback below
  }

  await emitTextChunks(fallback, onText);
  return fallback;
}
