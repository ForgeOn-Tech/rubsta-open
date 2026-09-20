import { desc, eq } from "drizzle-orm";
import Link from "next/link";
import { redirect } from "next/navigation";

import { submitEntry } from "./actions";
import { EntryForm } from "./entry-form";
import { requireUser } from "@/auth/require";
import { StatusBadge } from "@/components/status-badge";
import { db, getDb } from "@/db/client";
import { getEventFees } from "@/db/fees";
import { listPlayedCategories } from "@/db/partners";
import { CATEGORIES, entries, profiles, tournaments } from "@/db/schema";
import { ageFromDob } from "@/lib/age";
import { CATEGORY_LABELS, entriesOpen } from "@/lib/entries";
import { formatEntryCloses } from "@/lib/format";
import { razorpayConfig } from "@/lib/razorpay";
import { PROVISIONAL_SCHEDULE_NOTE } from "@/lib/tournament";
import { registrationState } from "@/db/registration";

export const dynamic = "force-dynamic";

export default async function RegisterPage() {
  const user = await requireUser();

  const profile = db
    .select()
    .from(profiles)
    .where(eq(profiles.userId, user.id))
    .get();
  if (!profile) redirect("/profile");

  const tournament = db.select().from(tournaments).get();
  if (!tournament) {
    return (
      <p className="card p-4 text-[13px] text-muted" role="status">
        No tournament is open for entries.
      </p>
    );
  }

  const registration = registrationState(getDb(), user.id, tournament.id);
  if (registration.paid) redirect("/home");
  if (registration.pendingId) redirect(`/register/${registration.pendingId}`);

  // Not filtered by tournament: the unique index is on (user, category).
  const myEntries = db
    .select()
    .from(entries)
    .where(eq(entries.userId, user.id))
    .orderBy(desc(entries.createdAt))
    .all();

  const closed = !entriesOpen(tournament);
  const fees = getEventFees(getDb(), tournament.id);
  const closesLabel = `${formatEntryCloses(tournament.entryClosesAt)} IST`;
  const age = ageFromDob(profile.dateOfBirth);
  const playerFacts = [
    age === null ? null : `Age ${age}`,
    profile.bestRanking,
    user.email,
  ].filter(Boolean);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <div className="eyebrow">{tournament.name} · Entry</div>
        <h1 className="mt-2 text-[20px] font-semibold tracking-[-0.01em]">
          Choose your categories
        </h1>
        <p className="mt-1.5 text-[13px] text-muted">
          Choose your event or combination before paying. One payment covers your
          selection; categories cannot be added after payment. Doubles entries need
          your partner&apos;s name and email.
        </p>
      </div>

      <section
        className="card flex items-start justify-between gap-4 p-4"
        aria-label="Player"
      >
        <div className="min-w-0">
          <div className="caps">Player</div>
          <div className="mt-1.5 truncate text-[14px] font-medium">
            {profile.fullName}
          </div>
          <div className="mono mt-1 truncate text-[11px] text-dim">
            {playerFacts.join(" · ")}
          </div>
        </div>
        <Link href="/profile" className="caps shrink-0">
          Edit profile
        </Link>
      </section>

      {myEntries.length > 0 ? (
        <section aria-labelledby="my-entries">
          <h2 id="my-entries" className="caps">
            Your entries
          </h2>
          <ul className="card mt-2 divide-y divide-line">
            {myEntries.map((entry) => (
              <li key={entry.id}>
                <Link
                  href={`/register/${entry.id}`}
                  className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-surface-2"
                >
                  <span className="min-w-0">
                    <span className="block text-[14px] font-medium text-ink">
                      {CATEGORY_LABELS[entry.category]}
                    </span>
                    {entry.partnerName ? (
                      <span className="mono mt-0.5 block truncate text-[11px] text-dim">
                        with {entry.partnerName}
                      </span>
                    ) : null}
                  </span>
                  <StatusBadge status={entry.status} />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {closed ? (
        <p className="card p-4 text-[13px] text-muted" role="status">
          Entries for {tournament.name} closed on {closesLabel}.
        </p>
      ) : (
        <EntryForm
          action={submitEntry}
          tournamentId={tournament.id}
          // Includes events the player joined as a doubles partner.
          enteredCategories={listPlayedCategories(getDb(), user.id)}
          feeCents={fees}
          closesLabel={closesLabel}
          paymentsEnabled={razorpayConfig(process.env) !== null}
        />
      )}

      {tournament.scheduleConfirmed ? null : (
        <p className="text-[11px] text-dim">{PROVISIONAL_SCHEDULE_NOTE}</p>
      )}
    </div>
  );
}
