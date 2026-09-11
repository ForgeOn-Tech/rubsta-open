import { eq } from "drizzle-orm";

import { requireUser } from "@/auth/require";
import { ProfileForm } from "./profile-form";
import { db } from "@/db/client";
import { profiles } from "@/db/schema";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const user = await requireUser();

  const profile = db
    .select()
    .from(profiles)
    .where(eq(profiles.userId, user.id))
    .get();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <div className="eyebrow">Rubsta Open 2026 · Player</div>
        <h1 className="mt-2 text-[20px] font-semibold tracking-[-0.01em]">
          {profile ? "Edit profile" : "Your details"}
        </h1>
        <p className="mt-1.5 text-[13px]" style={{ color: "var(--color-muted)" }}>
          This is the player record organisers see with your entry.
        </p>
      </div>

      <ProfileForm
        initial={profile ?? null}
        fallbackName={user.name}
        email={user.email}
      />
    </div>
  );
}
