import { DecidePlaceForm } from "./decide-place-form";
import type { GroupStandings } from "@/lib/groups";
import { groupPlaceLabel, groupRoundName, hasStarted } from "@/lib/groups";
import type { FormAction } from "@/lib/form-state";

export interface GroupCard {
  groupNumber: number;
  members: readonly { entryId: string; label: string; seed: number | null }[];
  /** Null while the draw is a draft. */
  standings: GroupStandings | null;
  /** By place: who went through, or null while the place waits. */
  through: readonly (string | null)[];
}

const COLUMNS = ["", "Player", "P", "W", "L", "Games"] as const;

/** Each group: its players, then once published its table, and a decision for a level place. */
export function GroupsSection({
  drawId,
  groups,
  decideAction,
}: {
  drawId: string;
  groups: readonly GroupCard[];
  decideAction: FormAction;
}) {
  return (
    <section aria-labelledby="groups-heading">
      <h2 id="groups-heading" className="thead">
        Groups
      </h2>
      <div className="mt-2 grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(300px,1fr))]">
        {groups.map((group) => (
          <GroupTable key={group.groupNumber} drawId={drawId} group={group} decideAction={decideAction} />
        ))}
      </div>
    </section>
  );
}

function GroupTable({ drawId, group, decideAction }: { drawId: string; group: GroupCard; decideAction: FormAction }) {
  const labelOf = new Map(group.members.map((member) => [member.entryId, member.label]));
  const label = (entryId: string): string => {
    const name = labelOf.get(entryId);
    if (name === undefined) throw new Error(`Group ${group.groupNumber} has no player ${entryId}.`);
    return name;
  };
  const { standings } = group;
  const rows =
    standings === null
      ? group.members.map((member) => ({ entryId: member.entryId, place: null, played: null, won: null, lost: null, games: null }))
      : standings.rows.map((row) => ({
          entryId: row.entryId,
          // Before any result, everyone shares first place, which says nothing.
          place: hasStarted(standings) ? row.place : null,
          played: row.played,
          won: row.won,
          lost: row.lost,
          games: `${row.gamesWon}–${row.gamesLost}`,
        }));
  const seedOf = new Map(group.members.map((member) => [member.entryId, member.seed]));
  const waiting = standings?.complete
    ? group.through.flatMap((entryId, index) => (entryId === null ? [index + 1] : []))
    : [];

  return (
    <article aria-label={groupRoundName(group.groupNumber)} className="card overflow-hidden">
      <h3 className="border-b border-line px-4 py-2.5 text-[14px] font-semibold">{groupRoundName(group.groupNumber)}</h3>
      <table className="w-full border-collapse text-left text-[13px]">
        <thead>
          <tr className="border-b border-line">
            {COLUMNS.map((column) => (
              <th key={column} scope="col" className="thead px-3 py-2 font-normal">
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const through = group.through.indexOf(row.entryId);
            return (
              <tr key={row.entryId} className="border-b border-line last:border-b-0">
                <td className="mono px-3 py-2 text-dim">{row.place ?? ""}</td>
                <th scope="row" className="px-3 py-2 text-left font-medium">
                  <span className="mono mr-1.5 text-[10px] text-accent">{seedOf.get(row.entryId) ?? ""}</span>
                  {label(row.entryId)}
                  {through === -1 ? null : (
                    <span className="ml-2 text-[11px] text-good">Through as {through === 0 ? "winner" : "runner-up"}</span>
                  )}
                </th>
                <td className="mono px-3 py-2">{row.played ?? "—"}</td>
                <td className="mono px-3 py-2">{row.won ?? "—"}</td>
                <td className="mono px-3 py-2">{row.lost ?? "—"}</td>
                <td className="mono px-3 py-2">{row.games ?? "—"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {waiting.map((place) => {
        if (standings === null) return null;
        // Players level on a place share the first of their places; any of them can take this one.
        const candidates = standings.rows
          .filter((row) => {
            const level = standings.rows.filter((other) => other.place === row.place).length;
            return level > 1 && row.place <= place && place <= row.place + level - 1 && !group.through.includes(row.entryId);
          })
          .map((row) => ({ entryId: row.entryId, label: label(row.entryId) }));
        return (
          <DecidePlaceForm
            key={place}
            drawId={drawId}
            groupNumber={group.groupNumber}
            place={place}
            placeLabel={groupPlaceLabel(group.groupNumber, place)}
            candidates={candidates}
            action={decideAction}
          />
        );
      })}
    </article>
  );
}
