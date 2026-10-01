import { addCourtAction, deleteCourtAction, saveTournamentSettings, updateCourtAction } from "./actions";
import { CourtsCard } from "./courts-card";
import { SettingsForm } from "./settings-form";
import { requireAdmin } from "@/auth/require";
import { AdminNotice } from "@/components/admin-notice";
import { AdminPageHeader } from "@/components/admin-page-header";
import { getDb } from "@/db/client";
import { listCourts } from "@/db/courts";
import { getEventFees } from "@/db/fees";
import { getCurrentTournament } from "@/db/queries";
import { CATEGORIES, type Category } from "@/db/schema";
import { feeRangeLabel } from "@/lib/fees";
import { formatTournamentDates } from "@/lib/format";
import { isoToIstLocal } from "@/lib/settings";

export const dynamic = "force-dynamic";

const PAISE_PER_RUPEE = 100;

export default async function AdminSettingsPage() {
  await requireAdmin();

  const tournament = getCurrentTournament();
  if (!tournament) return <AdminNotice message="No tournament has been set up." />;
  const fees = getEventFees(getDb(), tournament.id);

  return (
    <>
      <AdminPageHeader
        eyebrow={`${tournament.name} · Settings`}
        title="Tournament settings"
        stats={[
          formatTournamentDates(tournament.startsOn, tournament.endsOn) ?? "Dates not set",
          tournament.venue ?? "Venue not set",
          `Fees ${feeRangeLabel(fees, tournament.currency)}`,
          tournament.scheduleConfirmed ? "Schedule confirmed" : "Schedule provisional",
        ]}
      />
      <div className="flex flex-col gap-5 p-6">
        <SettingsForm
          tournamentId={tournament.id}
          action={saveTournamentSettings}
          initial={{
            name: tournament.name,
            startsOn: tournament.startsOn ?? "",
            endsOn: tournament.endsOn ?? "",
            venue: tournament.venue ?? "",
            entryClosesAt: isoToIstLocal(tournament.entryClosesAt),
            feeRupees: Object.fromEntries(
              CATEGORIES.map((category) => [category, String(fees[category] / PAISE_PER_RUPEE)]),
            ) as Record<Category, string>,
            status: tournament.status,
            scheduleConfirmed: tournament.scheduleConfirmed,
          }}
        />
        <CourtsCard
          courts={listCourts(getDb(), tournament.id)}
          addAction={addCourtAction}
          updateAction={updateCourtAction}
          deleteAction={deleteCourtAction}
        />
      </div>
    </>
  );
}
