import { z } from "zod";

import { startScan } from "@/server/api/scan-service";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const payload = await request.json().catch(() => ({} satisfies Record<string, never>));
    const started = await startScan(payload);
    return Response.json(started, { status: 201 });
  } catch (error) {
    const message =
      error instanceof z.ZodError
        ? error.issues[0]?.message ?? "Invalid scan payload."
        : error instanceof Error
          ? error.message
          : "Scan start failed.";

    return Response.json({ message }, { status: 400 });
  }
}
