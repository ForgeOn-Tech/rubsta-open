import { auth } from "@/auth/auth";
import { getDb } from "@/db/client";
import { getPlayerCard } from "@/db/player-cards";
import { storyCardResponse, storyCardTextResponse } from "@/lib/story-card-response";

/** The signed-in player's own story card. */
export async function GET(request: Request): Promise<Response> {
  const userId = (await auth())?.user?.id;
  if (!userId) return storyCardTextResponse("Sign in to get your player card.", 401);
  if (getPlayerCard(getDb(), userId) === null) return storyCardTextResponse("Create your player profile to get a player card.", 404);
  return storyCardResponse(request, userId);
}
