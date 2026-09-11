import type { Profile } from "@/db/schema";
import { ageFromDob } from "@/lib/age";
import { initials } from "@/lib/home";

const NOT_ADDED = "Not added";
const CARD_ACTIONS = ["Participation certificate", "Share card"] as const;

interface Stat {
  label: string;
  /** null marks a stat the app does not record yet. */
  value: string | null;
}

export interface PlayerCardProps {
  profile: Pick<
    Profile,
    "fullName" | "dateOfBirth" | "club" | "bestRanking" | "previousTournaments"
  >;
  entryCount: number;
}

export function PlayerCard({ profile, entryCount }: PlayerCardProps) {
  const age = ageFromDob(profile.dateOfBirth);
  const facts = [age === null ? null : `Age ${age}`, profile.club].filter(Boolean);
  const stats: Stat[] = [
    { label: "Best ranking", value: profile.bestRanking ?? NOT_ADDED },
    { label: "Events entered", value: String(entryCount) },
    { label: "Matches", value: null },
    { label: "Win–loss", value: null },
    { label: "Player ID", value: null },
    { label: "Plays", value: null },
  ];

  return (
    <div className="mt-6 grid gap-10 border-t border-club-line pt-6 lg:grid-cols-[3fr_2fr]">
      <div>
        <div className="flex items-center gap-4">
          <span
            aria-hidden="true"
            className="flex h-16 w-16 shrink-0 items-center justify-center border border-club-line bg-club-paper font-serif text-[26px]"
          >
            {initials(profile.fullName)}
          </span>
          <div className="min-w-0">
            <p className="truncate font-serif text-[30px] leading-tight">
              {profile.fullName}
            </p>
            {facts.length > 0 ? (
              <p className="mt-1 text-[11px] font-medium uppercase tracking-[1.5px] text-club-muted">
                {facts.join(" · ")}
              </p>
            ) : null}
          </div>
        </div>

        <dl className="mt-6 grid grid-cols-2 border-l border-t border-club-line sm:grid-cols-3">
          {stats.map((stat) => (
            <div key={stat.label} className="border-b border-r border-club-line px-4 py-4">
              <dt className="text-[10px] font-medium uppercase tracking-[1.5px] text-club-muted">
                {stat.label}
              </dt>
              <dd className="m-0 mt-2">
                {stat.value === null ? (
                  <>
                    <span
                      aria-hidden="true"
                      className="block font-serif text-[26px] leading-none text-club-muted"
                    >
                      —
                    </span>
                    <span className="mt-1.5 block text-[10px] font-medium uppercase tracking-[1.5px] text-club-muted">
                      Coming soon
                    </span>
                  </>
                ) : (
                  <span className="block font-serif text-[26px] leading-none lining-nums">
                    {stat.value}
                  </span>
                )}
              </dd>
            </div>
          ))}
        </dl>

        <div className="mt-5 flex flex-wrap gap-3">
          {CARD_ACTIONS.map((label) => (
            <button key={label} type="button" className="pill pill-outline" disabled>
              {label} · Coming soon
            </button>
          ))}
        </div>
      </div>

      <div>
        <h3 className="text-[10px] font-medium uppercase tracking-[2px] text-club-muted">
          Previous tournaments
        </h3>
        {profile.previousTournaments.length === 0 ? (
          <p className="mt-3 border-t border-club-line pt-3 text-[13px] text-club-muted">
            No previous tournaments added.
          </p>
        ) : (
          <ul className="mt-3 border-t border-club-line">
            {profile.previousTournaments.map((tournament, index) => (
              <li
                key={`${tournament.name}-${tournament.year}-${index}`}
                className="flex items-center justify-between gap-4 border-b border-club-line py-3"
              >
                <span className="min-w-0">
                  <span className="block truncate text-[14px] font-medium">
                    {tournament.name}
                  </span>
                  <span className="mono mt-0.5 block text-[11px] text-club-muted">
                    {tournament.year}
                  </span>
                </span>
                <span className="shrink-0 text-[12px] text-club-muted">
                  {tournament.result || NOT_ADDED}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
