import { addCourtAction, deleteCourtAction, saveTournamentSettings, updateCourtAction } from "./actions";
import { CourtsCard } from "./courts-card";
import { SettingsForm } from "./settings-form";
import { requireAdmin } from "@/auth/require";
import { AdminNotice } from "@/components/admin-notice";
import { AdminPageHeader } from "@/components/admin-page-header";
import { getDb } from "@/db/client";
import { listCourts } from "@/db/courts";
import { getCurrentTournament } from "@/db/queries";
import { formatFee, formatTournamentDates } from "@/lib/format";
import { isoToIstLocal } from "@/lib/settings";

export const dynamic = "force-dynamic";

const PAISE_PER_RUPEE = 100;

export default async function AdminSettingsPage() {
  await requireAdmin();

  const tournament = getCurrentTournament();
  if (!tournament) return <AdminNotice message="No tournament has been set up." />;

  return (
    <>
      <AdminPageHeader
        eyebrow={`${tournament.name} · Settings`}
        title="Tournament settings"
        stats={[
          formatTournamentDates(tournament.startsOn, tournament.endsOn) ?? "Dates not set",
          tournament.venue ?? "Venue not set",
          `Fee ${formatFee(tournament.feeCents, tournament.currency)}`,
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
            feeRupees: String(tournament.feeCents / PAISE_PER_RUPEE),
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
