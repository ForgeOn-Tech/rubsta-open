import { eq } from "drizzle-orm";

import { storyCardImage } from "./story-card-image";
import { auth } from "@/auth/auth";
import { getDb } from "@/db/client";
import { getPlayerCard } from "@/db/player-cards";
import { playerStoryFor } from "@/db/player-tags";
import { getProfilePhoto } from "@/db/profile-photos";
import { getCurrentTournament } from "@/db/queries";
import { playerAvatars } from "@/db/schema";
import { formatTournamentDates } from "@/lib/format";
import { initials } from "@/lib/home";
import { STORY_CARD_THEME_PARAM } from "@/lib/player-card";
import { STORY_PALETTES, STORY_THEMES, isStoryTheme } from "@/lib/story-themes";

const PRIVATE_NO_STORE = "private, no-store";

function textResponse(message: string, status: number): Response {
  return new Response(message, {
    status,
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": PRIVATE_NO_STORE },
  });
}

/** The player's photo, else their illustrated avatar, as a data URI; null for neither. */
function pictureOf(userId: string): string | null {
  const database = getDb();
  const photo = getProfilePhoto(database, userId);
  if (photo !== null) return `data:image/jpeg;base64,${photo.toString("base64")}`;
  const avatar = database.select({ png: playerAvatars.png }).from(playerAvatars).where(eq(playerAvatars.userId, userId)).get();
  return avatar?.png ? `data:image/png;base64,${avatar.png}` : null;
}

/**
 * The signed-in player's Instagram story card, in the colour theme named by `?theme=`
 * (Grass when it is left out). It shows nothing private: no age, mobile or email.
 */
export async function GET(request: Request): Promise<Response> {
  const theme = new URL(request.url).searchParams.get(STORY_CARD_THEME_PARAM) ?? STORY_THEMES[0];
  if (!isStoryTheme(theme)) return textResponse(`Unknown card theme "${theme}".`, 400);
  const userId = (await auth())?.user?.id;
  if (!userId) return textResponse("Sign in to get your player card.", 401);
  const database = getDb();
  const card = getPlayerCard(database, userId);
  if (card === null) return textResponse("Create your player profile to get a player card.", 404);

  const tournament = getCurrentTournament();
  const story = playerStoryFor(database, userId);
  return storyCardImage(
    {
      tournamentName: tournament?.name ?? "Rubsta Open",
      dates: tournament ? formatTournamentDates(tournament.startsOn, tournament.endsOn) : null,
      picture: pictureOf(userId),
      initials: initials(card.name),
      name: card.name,
      club: card.club,
      tag: story.tag,
      facts: story.facts,
      record: {
        played: card.totals.played,
        won: card.totals.won,
        events: card.tournaments.reduce((count, entry) => count + entry.results.length, 0),
      },
    },
    STORY_PALETTES[theme],
    { "Cache-Control": PRIVATE_NO_STORE },
  );
}
