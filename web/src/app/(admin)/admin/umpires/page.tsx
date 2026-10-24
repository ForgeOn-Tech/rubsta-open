import { addUmpireAction, revokeUmpireAction } from "./actions";
import { AddUmpireForm, ShareLink } from "./umpire-forms";
import { requireAdmin } from "@/auth/require";
import { AdminNotice } from "@/components/admin-notice";
import { AdminPageHeader } from "@/components/admin-page-header";
import { getDb } from "@/db/client";
import { getCurrentTournament } from "@/db/queries";
import { listUmpireLinks } from "@/db/umpire-links";
import { listedEmails } from "@/lib/access";
import { countLabel, formatEntryTime } from "@/lib/format";
import { venueDay } from "@/lib/schedule";
import { isLinkActive, umpireLinkPath } from "@/lib/umpire-links";

export const dynamic = "force-dynamic";

/** Umpires and their personal scoring links. */
export default async function AdminUmpiresPage() {
  await requireAdmin();
  const tournament = getCurrentTournament();
  if (!tournament) return <AdminNotice message="No tournament has been set up." />;

  const today = venueDay(new Date().getTime());
  const links = listUmpireLinks(getDb(), tournament.id);
  const active = links.filter((link) => isLinkActive(link, tournament.endsOn, today));
  const inactive = links.filter((link) => !isLinkActive(link, tournament.endsOn, today));
  const listed = listedEmails(process.env.UMPIRE_EMAILS ?? "");

  return (
    <>
      <AdminPageHeader
        eyebrow={`${tournament.name} · Umpires`}
        title="Umpires"
        stats={[countLabel(active.length, "scoring link", "scoring links"), countLabel(listed.length, "listed email", "listed emails")]}
      />
      <div className="flex flex-col gap-5 p-6">
        <section aria-labelledby="add-umpire" className="card flex max-w-2xl flex-col gap-4 p-5">
          <div>
            <h2 id="add-umpire" className="text-[15px] font-semibold">
              Add an umpire
            </h2>
            <p className="mt-1 text-[12px] text-muted">
              Each umpire gets a personal link. Send it to them, and they open it on their phone to score, with no
              account or password. The umpire picks any match from the list and scores it. Anyone with the link can score, so remove it if it reaches the wrong person.
              Links stop working the day after the tournament ends.
            </p>
          </div>
          <AddUmpireForm action={addUmpireAction} />
        </section>

        <section aria-labelledby="umpire-links" className="card flex max-w-2xl flex-col gap-3 p-5">
          <h2 id="umpire-links" className="text-[15px] font-semibold">
            Scoring links
          </h2>
          {active.length === 0 ? (
            <p className="text-[13px] text-muted">No umpires yet.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-line">
              {active.map((link) => (
                <li key={link.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div>
                    <div className="text-[14px] font-semibold">{link.name}</div>
                    <div className="text-[12px] text-muted">Added {formatEntryTime(link.createdAt)}</div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <ShareLink path={umpireLinkPath(link.token)} name={link.name} />
                    <form action={revokeUmpireAction}>
                      <input type="hidden" name="linkId" value={link.id} />
                      <button type="submit" className="btn btn-outline h-9 text-[12px]">
                        Remove
                      </button>
                    </form>
                  </div>
                </li>
              ))}
            </ul>
          )}
          {inactive.length === 0 ? null : (
            <p className="text-[12px] text-muted">
              No longer working: {inactive.map((link) => link.name).join(", ")}.
            </p>
          )}
        </section>

        {listed.length === 0 ? null : (
          <section aria-labelledby="listed-umpires" className="card flex max-w-2xl flex-col gap-2 p-5">
            <h2 id="listed-umpires" className="text-[15px] font-semibold">
              Umpires who sign in with Google
            </h2>
            <p className="text-[12px] text-muted">From UMPIRE_EMAILS in the server settings.</p>
            <p className="text-[13px]">{listed.join(", ")}</p>
          </section>
        )}
      </div>
    </>
  );
}
