import Link from "next/link";

import { AdminNav } from "./admin-nav";
import { signOutAction } from "@/auth/actions";
import { requireAdmin } from "@/auth/require";
import { db } from "@/db/client";
import { tournaments } from "@/db/schema";
import { formatEntryCloses } from "@/lib/format";

export const dynamic = "force-dynamic";

/** Organiser desktop shell from design/screens/Main.dc.html. */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireAdmin();
  const tournament = db.select().from(tournaments).get() ?? null;

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <aside className="flex flex-none flex-col border-b border-line bg-surface-1 md:sticky md:top-0 md:h-screen md:w-[220px] md:border-b-0 md:border-r">
        <div className="border-b border-line px-[18px] pb-[18px] pt-5">
          <div className="flex items-center gap-[9px]">
            <span
              aria-hidden="true"
              className="mono flex h-[22px] w-[22px] items-center justify-center bg-accent text-[12px] font-semibold text-accent-fg"
            >
              F
            </span>
            <span className="text-[13px] font-semibold tracking-[0.02em]">ForgeLabs</span>
          </div>
          <div className="eyebrow mt-2.5">Tournament OS · Admin</div>
        </div>

        <AdminNav />

        <div className="border-t border-line px-[18px] py-4 md:mt-auto">
          <div className="caps">Tournament</div>
          <div className="mt-1 text-[13px] font-semibold">
            {tournament?.name ?? "No tournament"}
          </div>
          {tournament ? (
            <div className="mono mt-1 text-[10.5px] text-dim">
              Entries close {formatEntryCloses(tournament.entryClosesAt)} IST
            </div>
          ) : null}
          <div className="mt-4 truncate text-[11px] text-dim">{user.email}</div>
          <div className="mt-2 flex items-center gap-4">
            <Link href="/home" className="caps">
              Player view
            </Link>
            <form action={signOutAction}>
              <button
                type="submit"
                className="caps hover:text-accent-deep"
                style={{ cursor: "pointer", background: "none", border: "none", padding: 0 }}
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
      </aside>

      <main className="min-w-0 flex-1">{children}</main>
    </div>
  );
}
