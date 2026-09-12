import { AutoRefresh } from "@/components/auto-refresh";
import { getDb } from "@/db/client";
import { fanLeaderboard } from "@/db/fan";
import { getCurrentTournament } from "@/db/queries";
import { PREDICTION_DISCLAIMER } from "@/lib/fan-predictions";

export const dynamic = "force-dynamic";

const REFRESH_SECONDS = 60;

/** Fans by points from their set predictions. Open to everyone. */
export default async function FanLeaderboardPage() {
  const tournament = getCurrentTournament();
  const scores = tournament ? fanLeaderboard(getDb(), tournament.id) : [];

  return (
    <div className="flex flex-col gap-8">
      <AutoRefresh seconds={REFRESH_SECONDS} />
      <div>
        <p className="text-[10px] font-medium uppercase tracking-[2px] text-club-lime">
          {tournament?.name ?? "Rubsta Open"} · Fan zone
        </p>
        <h1 className="mt-2 font-serif text-[46px] font-normal leading-none tracking-[-1px]">
          Prediction leaderboard
        </h1>
        <p className="mt-3 text-[13px] text-club-mist/70">{PREDICTION_DISCLAIMER}</p>
      </div>

      {scores.length === 0 ? (
        <p className="border-t border-club-mist/20 pt-5 text-[13px] text-club-mist/70" role="status">
          Nobody has called a finished set yet. Pick a court and call the next one.
        </p>
      ) : (
        <table className="w-full border-t border-club-mist/20 text-left">
          <caption className="sr-only">Fans by prediction points</caption>
          <thead>
            <tr className="text-[10px] uppercase tracking-[1.5px] text-club-mist/60">
              <th scope="col" className="py-2 font-medium">
                #
              </th>
              <th scope="col" className="py-2 font-medium">
                Fan
              </th>
              <th scope="col" className="py-2 text-right font-medium">
                Sets called
              </th>
              <th scope="col" className="py-2 text-right font-medium">
                Points
              </th>
            </tr>
          </thead>
          <tbody>
            {scores.map((score, index) => (
              <tr key={score.userId} className="border-t border-club-mist/15">
                <td className="py-2.5 text-[13px] lining-nums text-club-mist/60">{index + 1}</td>
                <td className="py-2.5 text-[15px]">{score.name}</td>
                <td className="py-2.5 text-right text-[13px] lining-nums text-club-mist/70">
                  {score.correct} of {score.decided}
                </td>
                <td className="py-2.5 text-right text-[15px] font-semibold lining-nums">{score.points}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
