import { eq } from "drizzle-orm";

import type { Database } from "./draws";
import { listPlayedCategories } from "./partners";
import { upsertProfile } from "./profiles";
import { CATEGORY_LABELS, entries, profiles, users } from "./schema";
import type { AdminEntryInput, Person } from "@/lib/admin-add-entry";
import { MANUAL_PAYMENT_REF } from "@/lib/entry-status";

/** The entry breaks a rule. Its message is for the admin. */
export class AdminEntryRejectedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AdminEntryRejectedError";
  }
}

interface Account {
  userId: string;
  fullName: string;
}

/** The account for this email, made with a profile when it has none. An existing profile is kept as it is. */
function accountFor(database: Database, person: Person): Account {
  const user = database.select({ id: users.id }).from(users).where(eq(users.email, person.email)).get()
    ?? database.insert(users).values({ name: person.fullName, email: person.email }).returning({ id: users.id }).get();
  const profile = database.select({ fullName: profiles.fullName }).from(profiles).where(eq(profiles.userId, user.id)).get()
    ?? upsertProfile(database, user.id, {
      fullName: person.fullName,
      dateOfBirth: person.dateOfBirth,
      gender: person.gender,
      mobile: person.mobile,
      club: person.club,
      bestRanking: null,
      previousTournaments: [],
      plays: null,
    });
  return { userId: user.id, fullName: profile.fullName };
}

function rejectIfPlaying(database: Database, account: Account, input: AdminEntryInput): void {
  if (listPlayedCategories(database, account.userId).includes(input.category)) {
    throw new AdminEntryRejectedError(`${account.fullName} already plays ${CATEGORY_LABELS[input.category]}.`);
  }
}

/**
 * Adds an entry for players who did not register themselves, and returns its id. Players and
 * partners are found by email or created with a profile. A doubles partner is accepted at once.
 */
export function addAdminEntry(database: Database, tournamentId: string, input: AdminEntryInput, now: number): string {
  return database.transaction((tx) => {
    const player = accountFor(tx, input.player);
    rejectIfPlaying(tx, player, input);
    const partner = input.partner === null ? null : accountFor(tx, input.partner);
    if (partner !== null) rejectIfPlaying(tx, partner, input);

    return tx.insert(entries).values({
      userId: player.userId,
      tournamentId,
      category: input.category,
      partnerName: partner?.fullName ?? null,
      partnerEmail: input.partner?.email ?? null,
      partnerStatus: partner === null ? null : "accepted",
      partnerUserId: partner?.userId ?? null,
      partnerRespondedAt: partner === null ? null : now,
      status: input.status,
      paymentRef: input.status === "paid" ? MANUAL_PAYMENT_REF : null,
    }).returning({ id: entries.id }).get().id;
  });
}
