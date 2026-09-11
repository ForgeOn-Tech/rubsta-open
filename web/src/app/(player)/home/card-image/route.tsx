import { eq } from "drizzle-orm";
import { ImageResponse } from "next/og";

import { auth } from "@/auth/auth";
import { getDb } from "@/db/client";
import { listScoringMatches } from "@/db/matches";
import { listTeamEntryIds } from "@/db/partners";
import { getCurrentTournament } from "@/db/queries";
import { HAND_LABELS, profiles } from "@/db/schema";
import { initials } from "@/lib/home";
import { formatPlayerId, matchRecord } from "@/lib/player-card";

const CARD_WIDTH = 1200;
const CARD_HEIGHT = 630;
const NAME_SIZE = 76;
const LONG_NAME_SIZE = 54;
const LONG_NAME_LENGTH = 22;
const STAT_SIZE = 36;
const PLAYER_ID_COLUMN_GROW = 1.6;
const PRIVATE_NO_STORE = "private, no-store";

// Club theme colours from globals.css.
const FOREST = "#294f35";
const CREAM = "#f8f5eb";
const MIST = "#f3f1df";
const LIME = "#dfeb8c";

/**
 * The signed-in player's card as a PNG to share. It shows only what the
 * player chooses to share: no date of birth, mobile or email.
 */
export async function GET(): Promise<Response> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return new Response("Sign in to get your player card.", {
      status: 401,
      headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": PRIVATE_NO_STORE },
    });
  }

  const database = getDb();
  const profile = database.select().from(profiles).where(eq(profiles.userId, userId)).get();
  if (!profile) {
    return new Response("Create your player profile to get a player card.", {
      status: 404,
      headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": PRIVATE_NO_STORE },
    });
  }

  const tournament = getCurrentTournament();
  const record = tournament
    ? matchRecord(
        listScoringMatches(database, tournament.id).map((row) => row.match),
        new Set(listTeamEntryIds(database, userId)),
      )
    : { played: 0, won: 0, lost: 0 };
  const facts = [profile.plays === null ? null : HAND_LABELS[profile.plays], profile.club]
    .filter((part) => part !== null)
    .join(" · ");
  const stats: [string, string][] = [
    ["Player ID", profile.playerNumber === null ? "Not assigned" : formatPlayerId(profile.playerNumber, profile.createdAt)],
    ["Matches", String(record.played)],
    ["Win–loss", `${record.won}–${record.lost}`],
    ["Best ranking", profile.bestRanking ?? "Not added"],
  ];
  const nameSize = profile.fullName.length > LONG_NAME_LENGTH ? LONG_NAME_SIZE : NAME_SIZE;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          backgroundColor: FOREST,
          color: MIST,
          padding: 64,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 22, letterSpacing: 4 }}>
          <span>{(tournament?.name ?? "Rubsta Open").toUpperCase()}</span>
          <span>PLAYER CARD</span>
        </div>
        <div style={{ display: "flex", alignItems: "center" }}>
          <div
            style={{
              display: "flex",
              width: 150,
              height: 150,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: CREAM,
              color: FOREST,
              fontSize: 64,
              marginRight: 36,
            }}
          >
            {initials(profile.fullName)}
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span style={{ fontSize: nameSize, lineHeight: 1 }}>{profile.fullName}</span>
            {facts === "" ? null : (
              <span style={{ marginTop: 16, fontSize: 26, letterSpacing: 2, color: LIME }}>{facts.toUpperCase()}</span>
            )}
          </div>
        </div>
        <div style={{ display: "flex", borderTop: `2px solid ${MIST}`, paddingTop: 28 }}>
          {stats.map(([label, value], index) => (
            <div
              key={label}
              // The player ID is the longest value, so its column is wider.
              style={{ display: "flex", flexDirection: "column", flex: index === 0 ? PLAYER_ID_COLUMN_GROW : 1, paddingRight: 24 }}
            >
              <span style={{ fontSize: 18, letterSpacing: 3 }}>{label.toUpperCase()}</span>
              <span style={{ fontSize: STAT_SIZE, marginTop: 8 }}>{value}</span>
            </div>
          ))}
        </div>
        <div style={{ display: "flex", fontSize: 18, letterSpacing: 3 }}>POWERED BY FORGELABS</div>
      </div>
    ),
    { width: CARD_WIDTH, height: CARD_HEIGHT, headers: { "Cache-Control": PRIVATE_NO_STORE } },
  );
}
