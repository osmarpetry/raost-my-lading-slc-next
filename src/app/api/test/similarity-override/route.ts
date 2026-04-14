import { scanRunStore } from "@/server/storage";
import { MemoryScanRunStore } from "@/server/storage/memory-store";

export async function POST(request: Request) {
  const isMockMode =
    process.env.SLC_MOCK_OPENAI === "true" || process.env.SLC_MOCK_SCAN === "true";

  if (!isMockMode) {
    return new Response("Forbidden", { status: 403 });
  }

  const body = (await request.json()) as { value?: number | null };
  const value = typeof body.value === "number" ? body.value : null;

  if (scanRunStore instanceof MemoryScanRunStore) {
    scanRunStore.setForceSimilarity(value);
  }

  return new Response("OK");
}
