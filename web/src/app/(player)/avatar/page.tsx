import { eq } from "drizzle-orm";
import Link from "next/link";
import { requireUser } from "@/auth/require";
import { getDb } from "@/db/client";
import { avatarShares, entries, playerAvatars, profiles } from "@/db/schema";
import { ageFromDob } from "@/lib/age";
import { avatarAccessError } from "@/lib/avatar";
import { AvatarStudio } from "./avatar-studio";

export const dynamic = "force-dynamic";
export const metadata = { title: "Your tennis avatar · Rubsta Open" };

export default async function AvatarPage() {
  const user = await requireUser();
  const db = getDb();
  const profile = db.select().from(profiles).where(eq(profiles.userId, user.id)).get();
  const paid = db.select().from(entries).where(eq(entries.userId, user.id)).all().some(entry => entry.status === "paid");
  const avatar = db.select({ version: playerAvatars.updatedAt }).from(playerAvatars).where(eq(playerAvatars.userId, user.id)).get();
  const shared = db.select({ version: avatarShares.avatarVersion }).from(avatarShares).where(eq(avatarShares.userId, user.id)).get();
  return <div className="flex flex-col gap-8">
    <Link href="/home" className="text-[12px] text-club-muted">← Back to player home</Link>
    <header className="max-w-2xl">
      <p className="text-[10px] uppercase tracking-[2px] text-club-muted">Rubsta Open · Avatar studio</p>
      <h1 className="mt-4 font-serif text-[48px] leading-none sm:text-[64px]">You, with a little<br /><em>court-side character.</em></h1>
      <p className="mt-5 max-w-xl text-[15px] leading-relaxed text-club-muted">Your photo becomes a cute tennis avatar. Make it yours, save your card, or let us feature it on Rubsta Open’s Instagram.</p>
    </header>
    <AvatarStudio name={profile?.fullName ?? user.name} enabled={!!process.env.OPENAI_API_KEY?.trim()}
      initialVersion={avatar?.version ?? null} initialShared={!!shared && shared.version === avatar?.version}
      accessError={avatarAccessError(profile ? ageFromDob(profile.dateOfBirth) : null, paid)} />
  </div>;
}
