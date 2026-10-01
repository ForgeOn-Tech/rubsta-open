import { and, eq, gte } from "drizzle-orm";
import type { Database } from "./draws";
import { avatarAttempts, playerAvatars } from "./schema";

/** Persistent quotas include failed attempts; concurrent requests cannot spend twice. */
export function reserveAvatar(database: Database, userId: string, now = Date.now()): string {
  return database.transaction(tx => {
    const recent = tx.select().from(avatarAttempts)
      .where(gte(avatarAttempts.startedAt, now - 86_400_000)).all();
    const mine = recent.filter(row => row.userId === userId);
    if (mine.some(row => !row.finished && row.startedAt > now - 240_000)) {
      throw new Error("Your avatar is still being generated. Please wait a few minutes.");
    }
    if (mine.length >= 3) throw new Error("You have used today's three avatar attempts. Try again tomorrow.");
    if (recent.length >= 50) throw new Error("Avatar generation has reached today's limit. Please try tomorrow.");
    const id = crypto.randomUUID();
    tx.insert(avatarAttempts).values({ id, userId, startedAt: now }).run();
    return id;
  }, { behavior: "immediate" });
}

export function finishAvatar(database: Database, userId: string, attempt: string, png?: string) {
  database.transaction(tx => {
    const active = tx.select().from(avatarAttempts).where(and(eq(avatarAttempts.id, attempt), eq(avatarAttempts.userId, userId))).get();
    if (!active || active.finished) return;
    if (png) {
      const values = { png, updatedAt: Date.now(), consentAt: active.startedAt };
      tx.insert(playerAvatars).values({ userId, ...values })
        .onConflictDoUpdate({ target: playerAvatars.userId, set: values }).run();
    }
    tx.update(avatarAttempts).set({ finished: true }).where(eq(avatarAttempts.id, attempt)).run();
  });
}

export function deleteAvatar(database: Database, userId: string) {
  database.transaction(tx => {
    tx.delete(playerAvatars).where(eq(playerAvatars.userId, userId)).run();
    // A generation still in flight must not restore deleted art. Retain quota records.
    tx.update(avatarAttempts).set({ finished: true }).where(eq(avatarAttempts.userId, userId)).run();
  });
}
