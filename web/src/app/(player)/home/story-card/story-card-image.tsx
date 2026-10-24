import { ImageResponse } from "next/og";

import type { StandoutFact } from "@/lib/player-facts";
import type { PlayerTag } from "@/lib/player-tag";
import type { StoryPalette } from "@/lib/story-themes";

const CARD_WIDTH = 1080;
const CARD_HEIGHT = 1920;
const PHOTO_SIZE = 540;
const FRAME = 14;
const PHOTO_SHADOW = 22;
const NAME_SIZE = 76;
const LONG_NAME_SIZE = 50;
const LONG_NAME_LENGTH = 20;
const TAG_SIZE = 92;
const LONG_TAG_SIZE = 66;
const LONG_TAG_LENGTH = 14;
const BALL_SIZE = 420;
// Instagram covers about the top 250px and bottom 340px of a story with its own buttons.
const SAFE_TOP = 230;
const SAFE_BOTTOM = 270;
const SIDE = 80;
const SITE = "rubstaopen.com";

/** Everything the card shows, already looked up. */
export interface StoryCardData {
  tournamentName: string;
  dates: string | null;
  /** A data URI for the photo or avatar, or null to show initials. */
  picture: string | null;
  initials: string;
  name: string;
  club: string | null;
  tag: PlayerTag;
  facts: readonly StandoutFact[];
  record: { played: number; won: number; events: number };
}

function counted(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

/** Faint court lines and a tennis ball behind the card, drawn in the theme's colours. */
function Backdrop({ palette }: { palette: StoryPalette }) {
  const line = `4px solid ${palette.lines}`;
  return (
    <div style={{ position: "absolute", top: 0, left: 0, width: CARD_WIDTH, height: CARD_HEIGHT, display: "flex" }}>
      <div style={{ position: "absolute", top: 120, left: 60, right: 60, bottom: 120, border: line, display: "flex" }} />
      <div style={{ position: "absolute", top: 120, bottom: 120, left: 200, borderLeft: line, display: "flex" }} />
      <div style={{ position: "absolute", top: 120, bottom: 120, right: 200, borderLeft: line, display: "flex" }} />
      <div style={{ position: "absolute", top: CARD_HEIGHT / 2, left: 60, right: 60, borderTop: line, display: "flex" }} />
      <div
        style={{
          position: "absolute",
          top: -BALL_SIZE / 3,
          right: -BALL_SIZE / 3,
          width: BALL_SIZE,
          height: BALL_SIZE,
          borderRadius: BALL_SIZE,
          backgroundColor: palette.tiles[1],
          opacity: 0.35,
          display: "flex",
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: -BALL_SIZE / 2,
          left: -BALL_SIZE / 3,
          width: BALL_SIZE,
          height: BALL_SIZE,
          borderRadius: BALL_SIZE,
          backgroundColor: palette.tiles[2],
          opacity: 0.3,
          display: "flex",
        }}
      />
    </div>
  );
}

function FactTiles({ facts, palette }: { facts: readonly StandoutFact[]; palette: StoryPalette }) {
  return (
    <div style={{ display: "flex", width: "100%", gap: 20, justifyContent: "center" }}>
      {facts.map((fact, index) => (
        <div
          key={fact.label}
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            flex: 1,
            maxWidth: 300,
            padding: "26px 12px 22px",
            backgroundColor: palette.tiles[index],
            color: palette.tileInk,
            borderRadius: 24,
          }}
        >
          <span style={{ fontSize: 80, lineHeight: 1 }}>{fact.value}</span>
          <span style={{ marginTop: 10, fontSize: 24, letterSpacing: 2, textAlign: "center" }}>{fact.label.toUpperCase()}</span>
        </div>
      ))}
    </div>
  );
}

function RecordNumbers({ record, palette }: { record: StoryCardData["record"]; palette: StoryPalette }) {
  const numbers: [string, number][] = [["Matches", record.played], ["Won", record.won], ["Events", record.events]];
  return (
    <div style={{ display: "flex", width: "100%", borderTop: `2px solid ${palette.ink}`, paddingTop: 30 }}>
      {numbers.map(([label, value]) => (
        <div key={label} style={{ display: "flex", flexDirection: "column", alignItems: "center", flex: 1 }}>
          <span style={{ fontSize: 72, lineHeight: 1 }}>{value}</span>
          <span style={{ marginTop: 10, fontSize: 24, letterSpacing: 4 }}>{label.toUpperCase()}</span>
        </div>
      ))}
    </div>
  );
}

/**
 * The 1080×1920 story card. With standout numbers, they take the colour tiles and the record
 * shrinks to one line; without, the record is shown large.
 */
export function storyCardImage(card: StoryCardData, palette: StoryPalette, headers: Record<string, string>): ImageResponse {
  const { record } = card;
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          position: "relative",
          backgroundColor: palette.background,
          color: palette.ink,
        }}
      >
        <Backdrop palette={palette} />
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "space-between",
            padding: `${SAFE_TOP}px ${SIDE}px ${SAFE_BOTTOM}px`,
          }}
        >
          <div style={{ display: "flex", width: "100%", justifyContent: "space-between", fontSize: 30, letterSpacing: 5 }}>
            <span>{card.tournamentName.toUpperCase()}</span>
            <span style={{ color: palette.accent }}>{(card.dates ?? "").toUpperCase()}</span>
          </div>

          <div
            style={{
              display: "flex",
              padding: FRAME,
              backgroundColor: palette.accent,
              boxShadow: `${PHOTO_SHADOW}px ${PHOTO_SHADOW}px 0 ${palette.tiles[2]}`,
            }}
          >
            {card.picture === null ? (
              <div
                style={{
                  display: "flex",
                  width: PHOTO_SIZE,
                  height: PHOTO_SIZE,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: palette.ink,
                  color: palette.background,
                  fontSize: 240,
                }}
              >
                {card.initials}
              </div>
            ) : (
              // eslint-disable-next-line @next/next/no-img-element -- Satori draws plain img elements
              <img src={card.picture} width={PHOTO_SIZE} height={PHOTO_SIZE} alt="" style={{ objectFit: "cover" }} />
            )}
          </div>

          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: "100%" }}>
            <div
              style={{
                display: "flex",
                backgroundColor: palette.accent,
                color: palette.tileInk,
                padding: "18px 44px",
                borderRadius: 16,
                fontSize: card.tag.title.length > LONG_TAG_LENGTH ? LONG_TAG_SIZE : TAG_SIZE,
                letterSpacing: 2,
              }}
            >
              {card.tag.title.toUpperCase()}
            </div>
            <span style={{ marginTop: 26, fontSize: 38, textAlign: "center" }}>{card.tag.line}</span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: "100%" }}>
            <span style={{ fontSize: card.name.length > LONG_NAME_LENGTH ? LONG_NAME_SIZE : NAME_SIZE, textAlign: "center", lineHeight: 1.05 }}>
              {card.name}
            </span>
            {card.club === null ? null : (
              <span style={{ marginTop: 14, fontSize: 28, letterSpacing: 4, color: palette.accent }}>{card.club.toUpperCase()}</span>
            )}
          </div>

          {card.facts.length === 0 ? (
            <RecordNumbers record={record} palette={palette} />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: "100%" }}>
              <FactTiles facts={card.facts} palette={palette} />
              <span style={{ marginTop: 22, fontSize: 26, letterSpacing: 4 }}>
                {[counted(record.played, "match", "matches"), `${record.won} won`, counted(record.events, "event", "events")].join("  ·  ").toUpperCase()}
              </span>
            </div>
          )}

          <div style={{ display: "flex", width: "100%", justifyContent: "space-between", fontSize: 24, letterSpacing: 4 }}>
            <span>{SITE.toUpperCase()}</span>
            <span>POWERED BY FORGELABS</span>
          </div>
        </div>
      </div>
    ),
    { width: CARD_WIDTH, height: CARD_HEIGHT, headers },
  );
}
