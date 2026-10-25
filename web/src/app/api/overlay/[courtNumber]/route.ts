import { courtOverlay } from "@/db/overlay";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ courtNumber: string }> }) {
  const data = courtOverlay((await params).courtNumber);
  return Response.json(data ?? { error: "Unknown court." }, {
    status: data ? 200 : 404,
    headers: { "Cache-Control": "no-store" },
  });
}
