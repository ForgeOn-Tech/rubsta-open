import { auth } from "@/auth/auth";
import { downloadPlayerCertificate } from "@/lib/certificate-download";

export async function GET(_request: Request, { params }: { params: Promise<{ entryId: string; kind: string }> }): Promise<Response> {
  const userId = (await auth())?.user?.id;
  if (!userId) return new Response("Sign in to download your certificates.", { status: 401, headers: { "Cache-Control": "private, no-store" } });
  const { entryId, kind } = await params;
  return downloadPlayerCertificate(userId, entryId, kind);
}
