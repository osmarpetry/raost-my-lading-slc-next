import { analysisCoordinator, scanManager } from "@/server/runtime";
import { resetRequestCounts } from "@/server/test-scan-deps";

export async function POST() {
  const isMockMode =
    process.env.SLC_MOCK_OPENAI === "true" || process.env.SLC_MOCK_SCAN === "true";

  if (!isMockMode) {
    return new Response("Forbidden", { status: 403 });
  }

  scanManager.clear();
  await analysisCoordinator.clear();
  resetRequestCounts();

  return new Response("OK");
}
