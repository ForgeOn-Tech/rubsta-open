import { desc, eq } from "drizzle-orm";
import { requireAdmin } from "@/auth/require";
import { AdminPageHeader } from "@/components/admin-page-header";
import { getDb } from "@/db/client";
import { avatarShares, profiles } from "@/db/schema";

export const dynamic = "force-dynamic";

export default async function AvatarPermissionsPage() {
  await requireAdmin();
  const shares = getDb().select({ userId: avatarShares.userId, name: profiles.fullName, consentAt: avatarShares.consentAt, consentText: avatarShares.consentText })
    .from(avatarShares).leftJoin(profiles, eq(profiles.userId, avatarShares.userId)).orderBy(desc(avatarShares.consentAt)).all();
  return <div className="flex flex-col gap-6">
    <AdminPageHeader eyebrow="Rubsta Open · Instagram" title="Avatar permissions" stats={[`${shares.length} approved cards`]} />
    <p className="mx-6 text-[13px] text-muted">These players have allowed Rubsta Open to post the cards shown here on its Instagram account. Download a card when you are ready to post. Refresh this page before posting to check that permission is still available.</p>
    {shares.length === 0 ? <p role="status" className="card mx-6 p-5 text-[13px]">No players have approved an Instagram card yet.</p> : <div className="mx-6 mb-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {shares.map(share => <article key={share.userId} aria-label={share.name ?? "Player"} className="card overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`/api/admin/avatars/${share.userId}?v=${share.consentAt}`} alt={`${share.name ?? "Player"} approved Instagram card`} className="aspect-[4/5] w-full object-contain" />
        <div className="flex flex-col gap-3 p-4">
          <h2 className="text-[16px] font-semibold">{share.name ?? "Player"}</h2>
          <p className="text-[11px] text-muted">Approved {new Date(share.consentAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })} IST</p>
          <p className="text-[12px] text-muted">“{share.consentText}”</p>
          <a href={`/api/admin/avatars/${share.userId}?download=1`} download className="btn btn-primary" style={{ color: "var(--color-accent-fg)" }}>Download approved card</a>
        </div>
      </article>)}
    </div>}
  </div>;
}
