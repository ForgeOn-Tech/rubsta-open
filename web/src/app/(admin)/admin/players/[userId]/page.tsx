import Link from "next/link";
import { notFound } from "next/navigation";

import { requireAdmin } from "@/auth/require";
import { AdminNotice } from "@/components/admin-notice";
import { AdminPageHeader } from "@/components/admin-page-header";
import { StatusBadge } from "@/components/status-badge";
import { getAdminPlayer } from "@/db/admin-players";
import { getDb } from "@/db/client";
import { listScoringMatches } from "@/db/matches";
import { getPlayerCard } from "@/db/player-cards";
import { profilePhotoVersion } from "@/db/profile-photos";
import { getCurrentTournament } from "@/db/queries";
import { listPublishedDays } from "@/db/schedule";
import { GENDER_LABELS, HAND_LABELS } from "@/db/schema";
import { ADMIN_ENTRIES_PATH, playerName } from "@/lib/admin-entries";
import { ageFromDob } from "@/lib/age";
import { certificateLabel } from "@/lib/certificates";
import { CATEGORY_LABELS } from "@/lib/entries";
import { countLabel } from "@/lib/format";
import { other } from "@/lib/match";
import { teamMatches, teamSide } from "@/lib/player-matches";
import { ADMIN_PLAYERS_PATH } from "@/lib/players";
import { placeLabel, publishedPlaces } from "@/lib/schedule";
import { matchSummary, sideLabel } from "@/lib/scoring-display";

import { AdminStoryCard } from "./admin-story-card";

export const dynamic = "force-dynamic";

const EMPTY_VALUE = "—";
const ADMIN_RESULTS_PATH = "/admin/results";
const ADMIN_STORY_CARD_PATH = "/api/admin/story-card";
const MATCH_STATUS_LABELS = { scheduled: "To play", in_progress: "In play", completed: "Played" } as const;

interface Detail {
  label: string;
  value: React.ReactNode;
}

export default async function AdminPlayerPage({ params }: { params: Promise<{ userId: string }> }) {
  await requireAdmin();
  const { userId } = await params;

  const tournament = getCurrentTournament();
  if (!tournament) return <AdminNotice message="No tournament has been set up." />;

  const database = getDb();
  const player = getAdminPlayer(database, userId, tournament.id);
  if (!player) notFound();

  const { profile } = player;
  const name = playerName(player);
  const age = profile ? ageFromDob(profile.dateOfBirth) : null;
  const card = getPlayerCard(database, userId);
  const certificates = card?.tournaments.flatMap((t) => t.certificates) ?? [];
  const results = card?.tournaments.flatMap((t) => t.results) ?? [];

  const activeIds = new Set(
    player.entries.filter(({ entry }) => entry.status !== "cancelled").map(({ entry }) => entry.id),
  );
  const rows = listScoringMatches(database, tournament.id);
  const matches = teamMatches(rows, activeIds).sort(
    (a, b) => a.match.roundIndex - b.match.roundIndex || a.match.matchNumber - b.match.matchNumber,
  );
  const places = publishedPlaces(
    listPublishedDays(database, tournament.id),
    new Map(rows.map((row) => [row.match.id, row.match.matchNumber])),
  );

  const details: Detail[] = [
    { label: "Email", value: player.email },
    { label: "Mobile", value: profile?.mobile ?? EMPTY_VALUE },
    {
      label: "Date of birth",
      value: profile ? `${profile.dateOfBirth}${age === null ? "" : ` · age ${age}`}` : EMPTY_VALUE,
    },
    { label: "Gender", value: profile ? GENDER_LABELS[profile.gender] : EMPTY_VALUE },
    { label: "Club", value: profile?.club ?? EMPTY_VALUE },
    { label: "Best ranking", value: profile?.bestRanking ?? EMPTY_VALUE },
    { label: "Plays", value: profile?.plays ? HAND_LABELS[profile.plays] : EMPTY_VALUE },
  ];
  const record = card?.totals ?? { played: 0, won: 0, lost: 0 };

  return (
    <>
      <AdminPageHeader
        eyebrow={`${tournament.name} · Player`}
        title={name}
        stats={[
          card?.playerId ?? "No player ID",
          countLabel(player.entries.length, "entry", "entries"),
          `${record.won}–${record.lost} in matches`,
        ]}
      >
        <Link href={ADMIN_PLAYERS_PATH} className="btn btn-outline h-8 text-[12px]">
          All players
        </Link>
      </AdminPageHeader>

      <div className="grid gap-5 p-6 lg:grid-cols-2">
        <section aria-labelledby="profile-heading" className="card">
          <h2 id="profile-heading" className="thead px-4 pt-4">
            Profile
          </h2>
          {profile ? null : <p className="px-4 pt-2 text-[13px] text-warn">No profile saved</p>}
          <dl className="mt-2 divide-y divide-line">
            {details.map((detail) => (
              <div key={detail.label} className="flex items-center justify-between gap-4 px-4 py-2.5">
                <dt className="caps">{detail.label}</dt>
                <dd className="m-0 text-right text-[13px]">{detail.value}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section aria-labelledby="entries-heading" className="card">
          <h2 id="entries-heading" className="thead px-4 pt-4">
            Entries
          </h2>
          {player.entries.length === 0 ? (
            <p className="px-4 py-3 text-[13px] text-muted">No entries in this tournament.</p>
          ) : (
            <ul className="mt-2 divide-y divide-line">
              {player.entries.map(({ entry, role, teammate }) => (
                <li key={entry.id} className="flex items-center justify-between gap-4 px-4 py-2.5 text-[13px]">
                  <span>
                    <Link href={`${ADMIN_ENTRIES_PATH}/${entry.id}`}>{CATEGORY_LABELS[entry.category]}</Link>
                    {teammate === null ? null : (
                      <span className="text-muted">
                        {role === "partner" ? " · partner of " : " · with "}
                        {teammate.userId === null ? (
                          teammate.name
                        ) : (
                          <Link href={`${ADMIN_PLAYERS_PATH}/${teammate.userId}`}>{teammate.name}</Link>
                        )}
                      </span>
                    )}
                  </span>
                  <StatusBadge status={entry.status} />
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby="results-heading" className="card lg:col-span-2">
          <h2 id="results-heading" className="thead px-4 pt-4">
            Results
          </h2>
          {results.length === 0 ? (
            <p className="px-4 py-3 text-[13px] text-muted">No results yet.</p>
          ) : (
            <ul className="mt-2 divide-y divide-line">
              {results.map((result) => (
                <li key={result.category} className="flex items-center justify-between gap-4 px-4 py-2.5 text-[13px]">
                  <span>{CATEGORY_LABELS[result.category]}</span>
                  <strong className="font-medium">{result.label}</strong>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby="matches-heading" className="card lg:col-span-2">
          <h2 id="matches-heading" className="thead px-4 pt-4">
            Matches
          </h2>
          {matches.length === 0 ? (
            <p className="px-4 py-3 text-[13px] text-muted">No matches yet.</p>
          ) : (
            <ul className="mt-2 divide-y divide-line">
              {matches.map((row) => {
                const side = teamSide(row, activeIds);
                if (side === null) throw new Error(`Match ${row.match.id} has none of ${name}'s entries.`);
                const opponent = other(side);
                const slot = opponent === "top" ? row.match.topSlot : row.match.bottomSlot;
                const place = places.get(row.match.id);
                const result =
                  row.match.status !== "completed"
                    ? MATCH_STATUS_LABELS[row.match.status]
                    : row.match.winnerEntryId !== null && activeIds.has(row.match.winnerEntryId)
                      ? "Won"
                      : "Lost";
                return (
                  <li key={row.match.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-2.5 text-[13px]">
                    <span>
                      <Link href={`${ADMIN_RESULTS_PATH}/${row.match.id}`}>
                        M{row.match.matchNumber} · {CATEGORY_LABELS[row.category]} · {row.match.roundName}
                      </Link>
                      <span className="text-muted"> · vs {sideLabel(row[opponent], slot).name}</span>
                    </span>
                    <span className="mono text-[12px] text-muted">
                      {place === undefined
                        ? "Not on the order of play"
                        : placeLabel(place)}
                    </span>
                    <span className="font-medium">
                      {result}
                      {matchSummary(row) === null ? null : <span className="mono"> · {matchSummary(row)}</span>}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section aria-labelledby="certificates-heading" className="card lg:col-span-2">
          <h2 id="certificates-heading" className="thead px-4 pt-4">
            Certificates
          </h2>
          {certificates.length === 0 ? (
            <p className="px-4 py-3 text-[13px] text-muted">No certificates earned yet.</p>
          ) : (
            <div className="flex flex-wrap gap-2 px-4 py-3">
              {certificates.map((certificate) => (
                <a
                  key={`${certificate.entryId}-${certificate.kind}`}
                  href={`/api/admin/certificates/${encodeURIComponent(userId)}/${encodeURIComponent(certificate.entryId)}/${certificate.kind}`}
                  download
                  className="btn btn-outline h-8 text-[12px]"
                >
                  {certificateLabel(certificate)} ↓
                </a>
              ))}
            </div>
          )}
        </section>

        {card === null ? null : (
          <section aria-labelledby="story-card-heading" className="card lg:col-span-2">
            <h2 id="story-card-heading" className="thead px-4 pt-4">
              Story card
            </h2>
            <AdminStoryCard
              imagePath={`${ADMIN_STORY_CARD_PATH}/${encodeURIComponent(userId)}`}
              name={name}
              hasPhoto={profilePhotoVersion(database, userId) !== null}
            />
          </section>
        )}

        {profile && profile.previousTournaments.length > 0 ? (
          <section aria-labelledby="history-heading" className="card lg:col-span-2">
            <h2 id="history-heading" className="thead px-4 pt-4">
              Previous tournaments
            </h2>
            <ul className="mt-2 divide-y divide-line">
              {profile.previousTournaments.map((past, index) => (
                <li
                  key={`${past.name}-${past.year}-${index}`}
                  className="flex items-center justify-between gap-4 px-4 py-2.5 text-[13px]"
                >
                  <span>
                    {past.name} <span className="mono text-[11px] text-dim">{past.year}</span>
                  </span>
                  <span className="text-muted">{past.result || EMPTY_VALUE}</span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </>
  );
}
