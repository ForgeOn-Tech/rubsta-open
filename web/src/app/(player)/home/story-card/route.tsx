import { eq } from "drizzle-orm";
import { ImageResponse } from "next/og";

import { auth } from "@/auth/auth";
import { getDb } from "@/db/client";
import { getPlayerCard } from "@/db/player-cards";
import { playerTagFor } from "@/db/player-tags";
import { getProfilePhoto } from "@/db/profile-photos";
import { getCurrentTournament } from "@/db/queries";
import { playerAvatars } from "@/db/schema";
import { formatTournamentDates } from "@/lib/format";
import { initials } from "@/lib/home";

const CARD_WIDTH = 1080;
const CARD_HEIGHT = 1920;
const PHOTO_SIZE = 580;
const FRAME = 14;
const NAME_SIZE = 76;
const LONG_NAME_SIZE = 50;
const LONG_NAME_LENGTH = 20;
const TAG_SIZE = 92;
const LONG_TAG_SIZE = 66;
const LONG_TAG_LENGTH = 14;
const PRIVATE_NO_STORE = "private, no-store";
// Instagram covers about the top 250px and bottom 340px of a story with its own buttons.
const SAFE_TOP = 230;
const SAFE_BOTTOM = 270;
const SITE = "rubstaopen.com";

// Club theme colours from globals.css.
const FOREST = "#294f35";
const CREAM = "#f8f5eb";
const MIST = "#f3f1df";
const LIME = "#dfeb8c";

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
 * The signed-in player's Instagram story card: their photo, a tag earned from how their
 * tournament went, and their record. It shows nothing private: no age, mobile or email.
 */
export async function GET(): Promise<Response> {
  const userId = (await auth())?.user?.id;
  if (!userId) return textResponse("Sign in to get your player card.", 401);
  const database = getDb();
  const card = getPlayerCard(database, userId);
  if (card === null) return textResponse("Create your player profile to get a player card.", 404);

  const tournament = getCurrentTournament();
  const tag = playerTagFor(database, userId);
  const picture = pictureOf(userId);
  const events = card.tournaments.reduce((count, entry) => count + entry.results.length, 0);
  const dates = tournament ? formatTournamentDates(tournament.startsOn, tournament.endsOn) : null;
  const stats: [string, string][] = [
    ["Matches", String(card.totals.played)],
    ["Won", String(card.totals.won)],
    ["Events", String(events)],
  ];

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "space-between",
          backgroundColor: FOREST,
          color: MIST,
          padding: `${SAFE_TOP}px 80px ${SAFE_BOTTOM}px`,
        }}
      >
        <div style={{ display: "flex", width: "100%", justifyContent: "space-between", fontSize: 30, letterSpacing: 5 }}>
          <span>{(tournament?.name ?? "Rubsta Open").toUpperCase()}</span>
          <span style={{ color: LIME }}>{(dates ?? "").toUpperCase()}</span>
        </div>

        <div style={{ display: "flex", padding: FRAME, backgroundColor: LIME }}>
          {picture === null ? (
            <div
              style={{
                display: "flex",
                width: PHOTO_SIZE,
                height: PHOTO_SIZE,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: CREAM,
                color: FOREST,
                fontSize: 260,
              }}
            >
              {initials(card.name)}
            </div>
          ) : (
            // eslint-disable-next-line @next/next/no-img-element -- Satori draws plain img elements
            <img src={picture} width={PHOTO_SIZE} height={PHOTO_SIZE} alt="" style={{ objectFit: "cover" }} />
          )}
        </div>

        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: "100%" }}>
          <div
            style={{
              display: "flex",
              backgroundColor: LIME,
              color: FOREST,
              padding: "18px 44px",
              fontSize: tag.title.length > LONG_TAG_LENGTH ? LONG_TAG_SIZE : TAG_SIZE,
              letterSpacing: 2,
            }}
          >
            {tag.title.toUpperCase()}
          </div>
          <span style={{ marginTop: 26, fontSize: 38, textAlign: "center" }}>{tag.line}</span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: "100%" }}>
          <span style={{ fontSize: card.name.length > LONG_NAME_LENGTH ? LONG_NAME_SIZE : NAME_SIZE, textAlign: "center", lineHeight: 1.05 }}>
            {card.name}
          </span>
          {card.club === null ? null : (
            <span style={{ marginTop: 14, fontSize: 28, letterSpacing: 4, color: LIME }}>{card.club.toUpperCase()}</span>
          )}
        </div>

        <div style={{ display: "flex", width: "100%", borderTop: `2px solid ${MIST}`, paddingTop: 30 }}>
          {stats.map(([label, value]) => (
            <div key={label} style={{ display: "flex", flexDirection: "column", alignItems: "center", flex: 1 }}>
              <span style={{ fontSize: 72, lineHeight: 1 }}>{value}</span>
              <span style={{ marginTop: 10, fontSize: 24, letterSpacing: 4 }}>{label.toUpperCase()}</span>
            </div>
          ))}
        </div>

        <div style={{ display: "flex", width: "100%", justifyContent: "space-between", fontSize: 24, letterSpacing: 4 }}>
          <span>{SITE.toUpperCase()}</span>
          <span>POWERED BY FORGELABS</span>
        </div>
      </div>
    ),
    { width: CARD_WIDTH, height: CARD_HEIGHT, headers: { "Cache-Control": PRIVATE_NO_STORE } },
  );
}
