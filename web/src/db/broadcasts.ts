import { and, eq } from "drizzle-orm";
import type { Database } from "./draws";
import { courtBroadcasts, courts } from "./schema";
import { validateBroadcast, type BroadcastSettings } from "@/lib/broadcast";

export function getBroadcast(database: Database, tournamentId: string, courtNumber: number): BroadcastSettings | null {
  const row = database.select({ court: courts, broadcast: courtBroadcasts }).from(courts)
    .leftJoin(courtBroadcasts, eq(courtBroadcasts.courtId, courts.id))
    .where(and(eq(courts.tournamentId, tournamentId), eq(courts.number, courtNumber))).get();
  if (!row) return null;
  return {
    // Existing links remain watchable but never claim that a camera is live.
    status: row.broadcast?.status ?? (row.court.streamUrl ? "scheduled" : "off"),
    streamUrl: row.court.streamUrl,
    replayUrl: row.broadcast?.replayUrl ?? null,
  };
}

export function saveBroadcast(database: Database, tournamentId: string, courtNumber: number, input: { status: string; streamUrl: string; replayUrl: string }) {
  const settings = validateBroadcast(input);
  return database.transaction(tx => {
    const court = tx.select().from(courts).where(and(eq(courts.tournamentId, tournamentId), eq(courts.number, courtNumber))).get();
    if (!court) throw new Error("This court does not exist in the current tournament.");
    tx.update(courts).set({ streamUrl: settings.streamUrl }).where(eq(courts.id, court.id)).run();
    const values = { status: settings.status, replayUrl: settings.replayUrl, updatedAt: Date.now() };
    tx.insert(courtBroadcasts).values({ courtId: court.id, ...values })
      .onConflictDoUpdate({ target: courtBroadcasts.courtId, set: values }).run();
    return settings;
  });
}
