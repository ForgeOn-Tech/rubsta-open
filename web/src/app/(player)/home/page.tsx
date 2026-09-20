import { desc, eq } from "drizzle-orm";
import Link from "next/link";

import { PlayerCard } from "./player-card";
import { PaymentWelcome } from "./payment-welcome";
import { AvatarStudio } from "./avatar-studio";
import { registrationState } from "@/db/registration";
import { avatarAccessError } from "@/lib/avatar";
import { ageFromDob } from "@/lib/age";
import { playerAvatars } from "@/db/schema";
import { requireUser } from "@/auth/require";
import { PartnerStatusBadge } from "@/components/partner-status-badge";
import { StatusBadge } from "@/components/status-badge";
import { db, getDb } from "@/db/client";
import { getEventFees } from "@/db/fees";
import { listScoringMatches, type ScoringMatchRow } from "@/db/matches";
import { listPartneredEntries, listPendingInvitations, listTeamEntryIds } from "@/db/partners";
import { listPublishedDays } from "@/db/schedule";
import { CATEGORIES, entries, profiles, tournaments } from "@/db/schema";
import { CATEGORY_LABELS, entriesOpen } from "@/lib/entries";
import {
  formatDate,
  formatEntryCloses,
  formatTournamentDates,
} from "@/lib/format";
import { feeRangeLabel } from "@/lib/fees";
import { UPCOMING_FEATURES, greetingName, nextStep } from "@/lib/home";
import { partnerInvitationPath } from "@/lib/partners";
import { other } from "@/lib/match";
import { certificateLabel, certificatePath, earnedCertificates } from "@/lib/certificates";
import { formatPlayerId, matchRecord } from "@/lib/player-card";
import {
  PLAYER_DRAWS_PATH,
  PLAYER_ORDER_OF_PLAY_PATH,
  nextMatch,
  teamSide,
} from "@/lib/player-matches";
import { placeLabel, publishedPlaces, type PublishedPlace } from "@/lib/schedule";
import { matchSummary, sideLabel } from "@/lib/scoring-display";
import { PROVISIONAL_SCHEDULE_NOTE } from "@/lib/tournament";

export const dynamic = "force-dynamic";

const FALLBACK_TOURNAMENT_NAME = "Rubsta Open";

export default async function HomePage({ searchParams }: {
  searchParams: Promise<{ paid?: string | string[] }>;
}) {
  const user = await requireUser();
  const { paid } = await searchParams;

  const profile =
    db.select().from(profiles).where(eq(profiles.userId, user.id)).get() ?? null;
  const tournament = db.select().from(tournaments).get() ?? null;
  // Not filtered by tournament: the unique index is on (user, category).
  const myEntries = db
    .select()
    .from(entries)
    .where(eq(entries.userId, user.id))
    .orderBy(desc(entries.createdAt))
    .all();
  const invitations = listPendingInvitations(getDb(), user.email);
  const partnered = listPartneredEntries(getDb(), user.id);
  const teamEntryIds = new Set(listTeamEntryIds(getDb(), user.id));
  const tournamentMatches = tournament ? listScoringMatches(getDb(), tournament.id) : [];
  const record = matchRecord(
    tournamentMatches.map((row) => row.match),
    teamEntryIds,
  );
  const publishedDays = tournament ? listPublishedDays(getDb(), tournament.id) : [];
  const places = publishedPlaces(
    publishedDays,
    new Map(tournamentMatches.map((row) => [row.match.id, row.match.matchNumber])),
  );
  const upcoming = nextMatch(tournamentMatches, teamEntryIds, places);

  const registration = registrationState(getDb(), user.id, tournament?.id);
  const step = nextStep({
    registrationPaid: registration.paid,
    pendingEntryId: registration.pendingId,
    hasProfile: profile !== null,
    entriesOpen: tournament ? entriesOpen(tournament) : null,
    enteredCount: myEntries.length + partnered.length,
    categoryCount: CATEGORIES.length,
  });
  const name = greetingName(profile?.fullName ?? null, user.name);
  const tournamentName = tournament?.name ?? FALLBACK_TOURNAMENT_NAME;
  const avatar = db.select({ updatedAt: playerAvatars.updatedAt }).from(playerAvatars)
    .where(eq(playerAvatars.userId, user.id)).get();
  // Never trust the query string alone as proof of payment or entry ownership.
  const paidEntry = typeof paid === "string"
    ? myEntries.find(entry => entry.id === paid && entry.status === "paid")
    : undefined;

  return (
    <div className="flex flex-col gap-16">
      {paidEntry ? <PaymentWelcome key={paidEntry.id} name={name} eventLabel={CATEGORY_LABELS[paidEntry.category]} /> : null}
      <section
        aria-labelledby="welcome-heading"
        className="relative overflow-hidden bg-club-forest px-6 py-10 text-club-mist sm:px-10 sm:py-14"
      >
        <CourtLines />
        <div className="relative">
          <p className="text-[10px] font-medium uppercase tracking-[2px]">
            {tournamentName} · Player home
          </p>
          <h1
            id="welcome-heading"
            className="mt-4 font-serif text-[46px] font-normal leading-none tracking-[-1.5px] sm:text-[64px]"
          >
            {name ? (
              <>
                Welcome, <em>{name}</em>
              </>
            ) : (
              "Welcome"
            )}
          </h1>

          <div className="mt-8 max-w-md bg-club-cream p-6 text-club-ink">
            <p className="text-[10px] font-medium uppercase tracking-[2px] text-club-muted">
              Next step
            </p>
            <h2 className="mt-2 font-serif text-[30px] font-normal leading-tight">
              {step.title}
            </h2>
            <p className="mt-2 text-[13px] leading-[1.7] text-club-muted">
              {step.description}
            </p>
            {step.action ? (
              <Link href={step.action.href} className="pill pill-primary mt-5">
                {step.action.label} <span aria-hidden="true">→</span>
              </Link>
            ) : null}
          </div>
        </div>
      </section>

      {profile && (avatar || myEntries.some(entry => entry.status === "paid")) ? (
        <AvatarStudio name={profile.fullName} enabled={!!process.env.OPENAI_API_KEY?.trim()}
          initialVersion={avatar?.updatedAt ?? null}
          accessError={avatarAccessError(ageFromDob(profile.dateOfBirth), myEntries.some(entry => entry.status === "paid"))} />
      ) : null}

      {invitations.length === 0 ? null : (
        <section aria-labelledby="invitations-heading">
          <SectionHeading id="invitations-heading" eyebrow="Doubles" title="Partner invitations" />
          <ul className="mt-6 border-t border-club-line">
            {invitations.map(({ entry, inviterName }) => (
              <li key={entry.id} className="border-b border-club-line">
                <Link
                  href={partnerInvitationPath(entry.id)}
                  className="flex items-center justify-between gap-4 py-4 hover:bg-club-paper sm:px-2"
                >
                  <span className="min-w-0">
                    <span className="block font-serif text-[24px] leading-tight">
                      {CATEGORY_LABELS[entry.category]}
                    </span>
                    <span className="mt-1 block truncate text-[12px] text-club-muted">
                      {inviterName} wants you as their partner
                    </span>
                  </span>
                  <span className="shrink-0 text-[11px] font-medium uppercase tracking-[1.5px] text-club-deep">
                    Answer <span aria-hidden="true">→</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="entries-heading">
        <SectionHeading id="entries-heading" eyebrow="01 / Entries" title="Your entries" />
        {myEntries.length + partnered.length === 0 ? (
          <p className="mt-6 border-t border-club-line pt-5 text-[13px] text-club-muted">
            You have not entered an event yet.
          </p>
        ) : (
          <ul className="mt-6 border-t border-club-line">
            {myEntries.map((entry) => (
              <li key={entry.id} className="border-b border-club-line">
                <Link
                  href={`/register/${entry.id}`}
                  className="flex items-center justify-between gap-4 py-4 hover:bg-club-paper sm:px-2"
                >
                  <span className="min-w-0">
                    <span className="block font-serif text-[24px] leading-tight">
                      {CATEGORY_LABELS[entry.category]}
                    </span>
                    <span className="mt-1 block truncate text-[12px] text-club-muted">
                      {[
                        entry.partnerName ? `With ${entry.partnerName}` : null,
                        `Entered ${formatDate(entry.createdAt)}`,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </span>
                  <span className="flex shrink-0 flex-col items-end gap-1.5">
                    <StatusBadge status={entry.status} />
                    {entry.partnerStatus === null ? null : (
                      <PartnerStatusBadge status={entry.partnerStatus} />
                    )}
                  </span>
                </Link>
              </li>
            ))}
            {partnered.map(({ entry, inviterName }) => (
              <li key={entry.id} className="border-b border-club-line">
                <Link
                  href={partnerInvitationPath(entry.id)}
                  className="flex items-center justify-between gap-4 py-4 hover:bg-club-paper sm:px-2"
                >
                  <span className="min-w-0">
                    <span className="block font-serif text-[24px] leading-tight">
                      {CATEGORY_LABELS[entry.category]}
                    </span>
                    <span className="mt-1 block truncate text-[12px] text-club-muted">
                      With {inviterName} · You joined as partner
                    </span>
                  </span>
                  <StatusBadge status={entry.status} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="next-match-heading">
        <SectionHeading id="next-match-heading" eyebrow="02 / Next match" title="Your next match">
          <div className="flex flex-wrap gap-3">
            <Link href={PLAYER_DRAWS_PATH} className="pill pill-outline">
              Draws
            </Link>
            {publishedDays.length > 0 ? (
              <Link href={PLAYER_ORDER_OF_PLAY_PATH} className="pill pill-outline">
                Order of play
              </Link>
            ) : null}
          </div>
        </SectionHeading>
        {upcoming === null ? (
          <p className="mt-6 border-t border-club-line pt-5 text-[13px] text-club-muted">
            No match is waiting for you. Your matches appear here once your draw is published.
          </p>
        ) : (
          <NextMatch row={upcoming} team={teamEntryIds} place={places.get(upcoming.match.id) ?? null} />
        )}
      </section>

      <section aria-labelledby="card-heading">
        <SectionHeading id="card-heading" eyebrow="03 / Player card" title="Your record">
          {profile ? (
            <Link href="/profile" className="pill pill-outline">
              Edit profile
            </Link>
          ) : null}
        </SectionHeading>
        {profile ? (
          <PlayerCard
            profile={profile}
            playerId={
              profile.playerNumber === null ? null : formatPlayerId(profile.playerNumber, profile.createdAt)
            }
            entryCount={myEntries.length + partnered.length}
            record={record}
            certificates={earnedCertificates(tournamentMatches, teamEntryIds).map((certificate) => ({
              href: certificatePath(certificate),
              label: certificateLabel(certificate),
            }))}
          />
        ) : (
          <p className="mt-6 border-t border-club-line pt-5 text-[13px] text-club-muted">
            Your player card starts when you create your profile.
          </p>
        )}
      </section>

      <section aria-labelledby="tournament-heading">
        <SectionHeading
          id="tournament-heading"
          eyebrow="04 / Tournament"
          title={tournamentName}
        />
        {tournament ? (
          <>
            <dl className="mt-6 grid border-l border-t border-club-line sm:grid-cols-2">
              {[
                {
                  label: "When",
                  value:
                    formatTournamentDates(tournament.startsOn, tournament.endsOn) ??
                    "Dates coming soon",
                },
                { label: "Where", value: tournament.venue ?? "Venue coming soon" },
                {
                  label: "Entries close",
                  value: `${formatEntryCloses(tournament.entryClosesAt)} IST`,
                },
                {
                  label: "Entry fee",
                  value: feeRangeLabel(getEventFees(getDb(), tournament.id), tournament.currency),
                },
              ].map((detail) => (
                <div key={detail.label} className="border-b border-r border-club-line px-5 py-5">
                  <dt className="text-[10px] font-medium uppercase tracking-[2px] text-club-muted">
                    {detail.label}
                  </dt>
                  <dd className="m-0 mt-2 font-serif text-[22px] leading-tight lining-nums">
                    {detail.value}
                  </dd>
                </div>
              ))}
            </dl>
            {tournament.scheduleConfirmed ? null : (
              <p className="mt-3 text-[12px] text-club-muted">{PROVISIONAL_SCHEDULE_NOTE}</p>
            )}
          </>
        ) : (
          <p className="mt-6 border-t border-club-line pt-5 text-[13px] text-club-muted">
            No tournament has been announced yet.
          </p>
        )}
      </section>

      <section aria-labelledby="coming-heading">
        <SectionHeading
          id="coming-heading"
          eyebrow="05 / Coming soon"
          title="More of the tournament"
        />
        <ul className="mt-6 grid gap-8 md:grid-cols-3">
          {UPCOMING_FEATURES.map((feature) => (
            <li key={feature.product} className="border-t border-club-line pt-5">
              <p className="text-[10px] font-medium uppercase tracking-[2px] text-club-muted">
                {feature.product}
              </p>
              <h3 className="mt-3 font-serif text-[28px] font-normal leading-tight">
                {feature.title}
              </h3>
              <p className="mt-3 text-[13px] leading-[1.8] text-club-muted">
                {feature.description}
              </p>
              <p className="mt-4 text-[10px] font-medium uppercase tracking-[1.5px] text-club-deep">
                Not yet available
              </p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function SectionHeading({
  id,
  eyebrow,
  title,
  children,
}: {
  id: string;
  eyebrow: string;
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="text-[10px] font-medium uppercase tracking-[2px] text-club-muted">
          {eyebrow}
        </p>
        <h2
          id={id}
          className="mt-2 font-serif text-[38px] font-normal leading-[1.05] tracking-[-1px] sm:text-[46px]"
        >
          {title}
        </h2>
      </div>
      {children}
    </div>
  );
}

/** The player's next match: event, opponent, and when and where it plays. */
function NextMatch({
  row,
  team,
  place,
}: {
  row: ScoringMatchRow;
  team: ReadonlySet<string>;
  place: PublishedPlace | null;
}) {
  const { match } = row;
  const side = teamSide(row, team);
  if (side === null) throw new Error(`Match ${match.id} is not one of this player's matches.`);
  const opponentSide = other(side);
  const opponent = sideLabel(
    opponentSide === "top" ? row.top : row.bottom,
    opponentSide === "top" ? match.topSlot : match.bottomSlot,
  );
  const summary = matchSummary(row);
  const when =
    match.status === "in_progress"
      ? `Live now${summary === null ? "" : ` · ${summary}`}`
      : place === null
        ? "Time to be announced"
        : placeLabel(place);

  return (
    <div className="mt-6 grid gap-6 border-t border-club-line pt-6 sm:grid-cols-[2fr_1fr]">
      <div className="min-w-0">
        <p className="text-[10px] font-medium uppercase tracking-[2px] text-club-muted">
          {CATEGORY_LABELS[row.category]} · {match.roundName} · M{match.matchNumber}
        </p>
        <p className="mt-2 truncate font-serif text-[34px] leading-tight">v {opponent.name}</p>
        <p className="mt-2 text-[13px] text-club-muted">{when}</p>
      </div>
      <div className="flex items-end sm:justify-end">
        <Link href={`${PLAYER_DRAWS_PATH}/${row.category}`} className="pill pill-primary">
          See the draw <span aria-hidden="true">→</span>
        </Link>
      </div>
    </div>
  );
}

/** Court markings from the landing page's closing section. */
function CourtLines() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-3 border border-club-mist/20"
    >
      <div className="absolute inset-y-0 left-[15%] right-[15%] border-x border-club-mist/20" />
      <div className="absolute inset-x-0 top-1/2 border-t border-club-mist/20" />
    </div>
  );
}
