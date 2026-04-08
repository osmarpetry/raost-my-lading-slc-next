import { getScanSnapshot } from "@/server/api/scan-service";

export const runtime = "nodejs";

interface RouteContext {
  params: Promise<{
    scanId: string;
  }>;
}

export async function GET(_request: Request, context: RouteContext) {
  const { scanId } = await context.params;
  const snapshot = getScanSnapshot(scanId);

  if (!snapshot) {
    return Response.json({ message: "Scan not found." }, { status: 404 });
  }

  return Response.json(snapshot);
}
