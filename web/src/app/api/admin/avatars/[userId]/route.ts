import { eq } from "drizzle-orm";
import { auth } from "@/auth/auth";
import { canAccessAdmin } from "@/auth/require";
import { getDb } from "@/db/client";
import { avatarShares } from "@/db/schema";

export async function GET(request: Request, { params }: { params: Promise<{ userId: string }> }) {
  const user = (await auth())?.user;
  const headers = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };
  if (!user?.id) return new Response("Sign in first.", { status: 401, headers });
  if (!canAccessAdmin(user.email ?? "")) return new Response("Admin access required.", { status: 403, headers });
  const { userId } = await params;
  const share = getDb().select().from(avatarShares).where(eq(avatarShares.userId, userId)).get();
  if (!share) return new Response("No approved card.", { status: 404, headers });
  return new Response(new Uint8Array(Buffer.from(share.png, "base64")), { headers: {
    ...headers, "Content-Type": "image/png",
    ...(new URL(request.url).searchParams.get("download") === "1" ? { "Content-Disposition": 'attachment; filename="rubsta-instagram-card.png"' } : {}),
  } });
}
