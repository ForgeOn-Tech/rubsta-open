import { ShareCardButton } from "./share-card-button";
import { HAND_LABELS, type Profile } from "@/db/schema";
import { ageFromDob } from "@/lib/age";
import { initials } from "@/lib/home";
import { PLAYER_CARD_FILE_NAME, PLAYER_CARD_IMAGE_PATH, type MatchRecord } from "@/lib/player-card";

const NOT_ADDED = "Not added";
const NOT_ASSIGNED = "Not assigned";

export interface CertificateLink {
  href: string;
  label: string;
}

interface Stat {
  label: string;
  value: string;
}

export interface PlayerCardProps {
  profile: Pick<
    Profile,
    "fullName" | "dateOfBirth" | "club" | "bestRanking" | "previousTournaments" | "plays"
  >;
  /** e.g. "FL-2026-0117"; null for a profile made before player numbers existed. */
  playerId: string | null;
  entryCount: number;
  record: MatchRecord;
  /** Certificate downloads the player has earned. */
  certificates: readonly CertificateLink[];
}

export function PlayerCard({ profile, playerId, entryCount, record, certificates }: PlayerCardProps) {
  const age = ageFromDob(profile.dateOfBirth);
  const hand = profile.plays === null ? null : HAND_LABELS[profile.plays];
  const facts = [age === null ? null : `Age ${age}`, hand, profile.club].filter(Boolean);
  const stats: Stat[] = [
    { label: "Best ranking", value: profile.bestRanking ?? NOT_ADDED },
    { label: "Events entered", value: String(entryCount) },
    { label: "Matches", value: String(record.played) },
    { label: "Win–loss", value: `${record.won}–${record.lost}` },
    { label: "Player ID", value: playerId ?? NOT_ASSIGNED },
    { label: "Plays", value: hand ?? NOT_ADDED },
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
                <span className="block font-serif text-[26px] leading-none lining-nums">
                  {stat.value}
                </span>
              </dd>
            </div>
          ))}
        </dl>

        <div className="mt-5 flex flex-wrap items-start gap-3">
          {certificates.map((certificate) => (
            <a key={certificate.href} href={certificate.href} className="pill pill-outline" download>
              {certificate.label} <span aria-hidden="true">↓</span>
            </a>
          ))}
          <ShareCardButton
            imagePath={PLAYER_CARD_IMAGE_PATH}
            fileName={PLAYER_CARD_FILE_NAME}
            title={`${profile.fullName} · Player card`}
          />
        </div>
        {certificates.length === 0 ? (
          <p className="mt-3 text-[12px] text-club-muted">
            Certificates appear here after your first match.
          </p>
        ) : null}
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
