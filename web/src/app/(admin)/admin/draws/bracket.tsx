import type { BracketRound, BracketSlot } from "@/lib/draws";

// Height of one match card, so later rounds space out against the first round.
const MATCH_HEIGHT_PX = 92;

export interface BracketProps {
  rounds: readonly BracketRound[];
  /** Entry id → name shown on the draw. */
  labels: ReadonlyMap<string, string>;
}

export function Bracket({ rounds, labels }: BracketProps) {
  const firstRoundMatches = rounds[0]?.matches.length ?? 0;

  return (
    <div className="card overflow-x-auto p-4">
      <ol className="flex min-w-max gap-6">
        {rounds.map((round) => (
          <li key={round.name} className="w-[230px] flex-none">
            <h3 className="flex items-baseline gap-2">
              <span className="thead">{round.name}</span>
              <span className="mono text-[10px] text-dim">
                {round.matches.length} {round.matches.length === 1 ? "match" : "matches"}
              </span>
            </h3>
            <ol
              className="mt-3 flex flex-col justify-around gap-3"
              style={{ minHeight: `${firstRoundMatches * MATCH_HEIGHT_PX}px` }}
            >
              {round.matches.map((match) => (
                <li
                  key={match.number}
                  aria-label={`Match ${match.number}`}
                  className="border border-line bg-surface-1"
                >
                  <div className="mono border-b border-line px-2.5 py-1 text-[10px] text-dim">
                    M{match.number}
                  </div>
                  <SlotRow slot={match.top} labels={labels} />
                  <SlotRow slot={match.bottom} labels={labels} />
                </li>
              ))}
            </ol>
          </li>
        ))}
      </ol>
    </div>
  );
}

function SlotRow({ slot, labels }: { slot: BracketSlot; labels: ReadonlyMap<string, string> }) {
  if (slot.kind === "bye") {
    return <div className="px-2.5 py-1.5 text-[12px] italic text-dim">Bye</div>;
  }
  if (slot.kind === "winner") {
    return <div className="px-2.5 py-1.5 text-[12px] text-muted">Winner M{slot.matchNumber}</div>;
  }
  const label = labels.get(slot.entryId);
  if (label === undefined) throw new Error(`The draw refers to unknown entry ${slot.entryId}.`);
  return (
    <div className="flex items-center gap-2 px-2.5 py-1.5 text-[12px]">
      <span className="mono w-4 flex-none text-[10px] text-accent">{slot.seed ?? ""}</span>
      <span className="truncate">{label}</span>
    </div>
  );
}
