import type { Side } from "@/lib/match";
import type { StatRow } from "@/lib/match-stats";

/** Side-by-side match statistics, laid out as on design/screens/LiveBoard.dc.html. */
export function MatchStatsTable({
  rows,
  names,
}: {
  rows: readonly StatRow[];
  names: Record<Side, string>;
}) {
  return (
    <table className="w-full border-collapse">
      <caption className="thead pb-1 text-left">Match statistics</caption>
      <thead>
        <tr>
          <th scope="col" className="p-0">
            <span className="sr-only">{names.top}</span>
          </th>
          <th scope="col" className="p-0">
            <span className="sr-only">Statistic</span>
          </th>
          <th scope="col" className="p-0">
            <span className="sr-only">{names.bottom}</span>
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.label} className="border-b border-line last:border-b-0">
            <td className="mono w-[64px] py-[11px] text-left text-[16px] font-semibold">{row.top}</td>
            <th scope="row" className="caps py-[11px] text-center text-[11px] font-medium">
              {row.label}
            </th>
            <td className="mono w-[64px] py-[11px] text-right text-[16px] font-semibold text-muted">
              {row.bottom}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
