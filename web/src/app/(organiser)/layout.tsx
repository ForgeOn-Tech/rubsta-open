import Link from "next/link";

import { signOutAction } from "@/auth/actions";
import { requireEntriesAccess } from "@/auth/require";

export const dynamic = "force-dynamic";

export default async function OrganiserLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireEntriesAccess();

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-line bg-surface-1">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-5 py-4">
          <div className="flex items-center gap-3">
            <span
              className="mono flex h-[22px] w-[22px] items-center justify-center bg-accent text-[12px] font-semibold text-accent-fg"
              aria-hidden="true"
            >
              F
            </span>
            <span className="text-[13px] font-semibold tracking-[0.02em]">
              ForgeLabs
            </span>
            <span className="eyebrow hidden sm:inline">
              Tournament OS · Organiser
            </span>
          </div>
          <div className="flex items-center gap-4">
            <span className="caps hidden sm:inline">
              {user.name || user.email}
            </span>
            <Link href="/register" className="caps">
              Player view
            </Link>
            <form action={signOutAction}>
              <button
                type="submit"
                className="caps hover:text-accent-deep"
                style={{ cursor: "pointer", background: "none", border: "none" }}
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-5 py-6">{children}</main>
    </div>
  );
}
