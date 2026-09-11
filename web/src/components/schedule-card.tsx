import type { ReactNode } from "react";

import type { ScoringMatchRow } from "@/db/matches";
import { CATEGORY_LABELS, type MatchStatus } from "@/db/schema";
import { SIDES, type Side } from "@/lib/match";
import { SCHEDULE_STATUS_LABELS, timingLabel, type ScheduleEntry } from "@/lib/schedule";
import { setGamesBySide, sideLabel } from "@/lib/scoring-display";

export interface ScheduleCardProps {
  entry: ScheduleEntry;
  /** The match for a match item; null for a session. */
  row: ScoringMatchRow | null;
  /** How the item above on the same court is named, or null at the top. */
  previousName: string | null;
  umpireName: string | null;
  /** Admin controls. The umpires' view has none. */
  children?: ReactNode;
}

const STATUS_STYLES: Record<MatchStatus, string> = {
  scheduled: "bg-surface-2 text-muted",
  in_progress: "bg-accent font-semibold text-accent-fg",
  completed: "border border-line text-dim",
};

function winnerSide(row: ScoringMatchRow): Side | null {
  const { match } = row;
  if (match.winnerEntryId === null) return null;
  const won = SIDES.find((side) => {
    const slot = side === "top" ? match.topSlot : match.bottomSlot;
    return slot.kind === "entry" && slot.entryId === match.winnerEntryId;
  });
  return won ?? null;
}

/** One match or session on a court's order of play (design/screens/OrderOfPlay.dc.html). */
export function ScheduleCard({ entry, row, previousName, umpireName, children }: ScheduleCardProps) {
  const timing = timingLabel(entry, previousName);

  if (entry.kind === "block") {
    return (
      <article aria-label={entry.title ?? "Session"} className="card p-3.5">
        <div className="caps text-[10px]">Session</div>
        <div className="mt-1 text-[14px] font-semibold">{entry.title}</div>
        <div className="mono mt-1 text-[10.5px] text-muted">
          {[timing, entry.note].filter((part) => part !== null).join(" · ")}
        </div>
        {children}
      </article>
    );
  }

  if (row === null) throw new Error(`Schedule item ${entry.id} has no match to show.`);
  const { match } = row;
  const sides = { top: sideLabel(row.top, match.topSlot), bottom: sideLabel(row.bottom, match.bottomSlot) };
  const games = setGamesBySide(row);
  const winner = winnerSide(row);
  const event = `${CATEGORY_LABELS[row.category]} · ${match.roundName}`;

  return (
    <article aria-label={`M${match.matchNumber} ${event}`} className="card p-3.5">
      <div className="mb-[9px] flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-baseline gap-[7px]">
          <span className="mono text-[10px] text-dim">M{match.matchNumber}</span>
          <span className="caps truncate text-[10px]">{event}</span>
        </div>
        <span
          className={`mono inline-flex h-[19px] flex-none items-center px-[7px] text-[9.5px] uppercase tracking-[0.08em] ${STATUS_STYLES[match.status]}`}
        >
          {SCHEDULE_STATUS_LABELS[match.status]}
        </span>
      </div>
      <div className="border-y border-line py-[5px]">
        {SIDES.map((side) => (
          <div key={side} className="flex h-[22px] items-center gap-[7px]">
            <span className="mono w-3 flex-none text-[10px] text-dim">{sides[side].seed ?? ""}</span>
            <span
              className={`min-w-0 flex-1 truncate text-[12.5px] ${
                winner === side ? "font-semibold text-ink" : winner === null ? "font-medium text-ink" : "font-medium text-muted"
              }`}
            >
              {sides[side].name}
            </span>
            {games === null ? null : (
              <span className="mono flex-none text-[12px] font-semibold tracking-[0.04em]">{games[side]}</span>
            )}
          </div>
        ))}
      </div>
      <div className="mt-[9px] flex items-center justify-between gap-2">
        <span className="mono flex-none text-[10.5px] tracking-[0.04em] text-muted">{timing}</span>
        <span className="mono truncate text-[10px] text-dim">
          {umpireName === null ? "No umpire" : `Umpire: ${umpireName}`}
        </span>
      </div>
      {children}
    </article>
  );
}
