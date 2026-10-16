import { eq } from "drizzle-orm";
import type { Database } from "./draws";
import { listScoringMatches } from "./matches";
import { listTeamEntryIds } from "./partners";
import { profiles, users } from "./schema";
import { earnedCertificates } from "@/lib/certificates";

export function listAdminCertificates(database: Database, tournamentId: string) {
  const matches = listScoringMatches(database, tournamentId);
  const players = database.select({ userId: profiles.userId, name: profiles.fullName, email: users.email })
    .from(profiles).innerJoin(users, eq(users.id, profiles.userId)).all();
  return players.flatMap(player => earnedCertificates(matches, new Set(listTeamEntryIds(database, player.userId)))
    .map(certificate => ({ ...player, ...certificate })))
    .sort((a, b) => a.name.localeCompare(b.name) || a.category.localeCompare(b.category) || a.kind.localeCompare(b.kind));
}
