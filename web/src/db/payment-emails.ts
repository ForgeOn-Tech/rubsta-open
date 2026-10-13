import { eq } from "drizzle-orm";
import type { Database } from "./draws";
import { entries, payments, paymentEmails, profiles, tournaments, users, CATEGORY_LABELS } from "./schema";
import { registrationConfirmation } from "@/lib/registration-email";
import { formatFee } from "@/lib/format";

/** Called inside the verified capture transaction; snapshot before entries change. */
export function queuePaymentEmail(database: Database, paymentRowId: string): void {
  const payment = database.select().from(payments).where(eq(payments.id, paymentRowId)).get();
  if (!payment || payment.status !== "paid" || !payment.paymentId || payment.paidAt === null) return;
  const entry = database.select().from(entries).where(eq(entries.id, payment.entryId)).get();
  const user = database.select().from(users).where(eq(users.id, payment.userId)).get();
  if (!entry || !user) throw new Error("Missing payment confirmation recipient.");
  const tournament = database.select().from(tournaments).where(eq(tournaments.id, entry.tournamentId)).get();
  if (!tournament) throw new Error("Missing payment confirmation tournament.");
  const profile = database.select().from(profiles).where(eq(profiles.userId, user.id)).get();
  const covered = database.select().from(entries).where(eq(entries.paymentRef, payment.paymentId)).all();
  const confirmed = covered.length > 0 && covered.every(item => item.status === "paid");
  const amount = formatFee(payment.amountCents, payment.currency);
  const when = new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata",
  }).format(new Date(payment.paidAt));
  const { subject, body, html } = registrationConfirmation({
    playerName: profile?.fullName ?? user.name ?? "player",
    tournamentName: tournament.name,
    events: (confirmed ? covered : [entry]).map(item => CATEGORY_LABELS[item.category]).join(" + "),
    entryConfirmed: confirmed,
    partnerPending: covered.some(item => item.category === "OD" && item.partnerStatus !== "accepted"),
    amount, paymentReference: payment.paymentId, orderReference: payment.orderId,
    paidOn: when + " IST",
  });
  database.insert(paymentEmails).values({
    paymentId: payment.id, recipient: user.email, subject, body, html, createdAt: Date.now(),
  }).onConflictDoNothing().run();
}
