import { z } from "zod";

import { cancelScan } from "@/server/api/scan-service";

export const runtime = "nodejs";

interface RouteContext {
  params: Promise<{
    scanId: string;
  }>;
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const payload = await request.json().catch(() => ({} satisfies Record<string, never>));
    const { scanId } = await context.params;
    const snapshot = await cancelScan(scanId, payload);

    if (!snapshot) {
      return Response.json({ message: "Scan not found." }, { status: 404 });
    }

    return Response.json(snapshot);
  } catch (error) {
    const message =
      error instanceof z.ZodError
        ? error.issues[0]?.message ?? "Invalid cancel payload."
        : error instanceof Error
          ? error.message
          : "Scan cancel failed.";

    return Response.json({ message }, { status: 400 });
  }
}
