import { and, eq } from "drizzle-orm";
import type { Database } from "./draws";
import { entries, payments } from "./schema";

/** One registration checkout per player and tournament, including historical payments. */
export function registrationState(database: Database, userId: string, tournamentId?: string) {
  const owned = database.select().from(entries).where(and(
    eq(entries.userId, userId),
    tournamentId ? eq(entries.tournamentId, tournamentId) : undefined,
  )).all();
  const captured = database.select({ entryId: payments.entryId }).from(payments)
    .where(and(eq(payments.userId, userId), eq(payments.status, "paid"))).all();
  const paid = owned.some(entry => entry.status === "paid" || entry.paymentRef !== null || captured.some(payment => payment.entryId === entry.id));
  const pending = owned.find(entry => entry.status === "submitted" || entry.status === "confirmed");
  return { paid, pendingId: paid ? null : pending?.id ?? null };
}
