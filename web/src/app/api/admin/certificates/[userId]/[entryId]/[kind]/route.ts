import { auth } from "@/auth/auth";
import { canAccessAdmin } from "@/auth/require";
import { downloadPlayerCertificate } from "@/lib/certificate-download";

export async function GET(_request: Request, { params }: { params: Promise<{ userId: string; entryId: string; kind: string }> }): Promise<Response> {
  const user = (await auth())?.user;
  const headers = { "Cache-Control": "private, no-store" };
  if (!user?.id) return new Response("Sign in first.", { status: 401, headers });
  if (!canAccessAdmin(user.email ?? "")) return new Response("Admin access required.", { status: 403, headers });
  const { userId, entryId, kind } = await params;
  return downloadPlayerCertificate(userId, entryId, kind);
}
