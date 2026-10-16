import Link from "next/link";

import { addEntry } from "../actions";
import { AddEntryForm } from "./add-entry-form";
import { requireAdmin } from "@/auth/require";
import { AdminNotice } from "@/components/admin-notice";
import { AdminPageHeader } from "@/components/admin-page-header";
import { getCurrentTournament } from "@/db/queries";
import { ADMIN_ENTRIES_PATH } from "@/lib/admin-entries";
import { entriesOpen } from "@/lib/entries";

export const dynamic = "force-dynamic";

export default async function AdminNewEntryPage() {
  await requireAdmin();

  const tournament = getCurrentTournament();
  if (!tournament) return <AdminNotice message="No tournament has been set up." />;

  return (
    <>
      <AdminPageHeader
        eyebrow={`${tournament.name} · Entries`}
        title="Add entry"
        stats={[entriesOpen(tournament) ? "Entries open" : "Entries closed; admins can still add"]}
      >
        <Link href={ADMIN_ENTRIES_PATH} className="btn btn-outline h-8 text-[12px]">
          Back to entries
        </Link>
      </AdminPageHeader>
      <div className="flex flex-col gap-5 p-6">
        <AddEntryForm action={addEntry} />
      </div>
    </>
  );
}
