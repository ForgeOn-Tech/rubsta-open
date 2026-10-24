import { auth } from "@/auth/auth";
import { canAccessAdmin } from "@/auth/require";
import { storyCardResponse, storyCardTextResponse } from "@/lib/story-card-response";

/** Any player's story card, for admins. */
export async function GET(request: Request, { params }: { params: Promise<{ userId: string }> }): Promise<Response> {
  const user = (await auth())?.user;
  if (!user?.id) return storyCardTextResponse("Sign in first.", 401);
  if (!canAccessAdmin(user.email ?? "")) return storyCardTextResponse("Admin access required.", 403);
  const { userId } = await params;
  return storyCardResponse(request, userId);
}
