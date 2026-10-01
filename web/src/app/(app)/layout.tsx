import Link from "next/link";
import { redirect } from "next/navigation";

import { signOutAction } from "@/auth/actions";
import { auth } from "@/auth/auth";
import { canAccessAdmin, canScoreMatches } from "@/auth/require";

export const dynamic = "force-dynamic";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin");

  const demoMode = process.env.DEMO_AUTH === "true";
  const admin = canAccessAdmin(session.user.email ?? "");
  const scorer = canScoreMatches(session.user.email ?? "");

  return (
    <div className="flex min-h-screen flex-col">
      <header
        className="rubsta-entry-header"
        style={{ borderColor: "var(--color-line)" }}
      >
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-4 px-5 py-4">
          <Link href="/home" className="flex flex-col gap-1">
            <span className="rubsta-wordmark">
              Rubsta <em>Open</em>
            </span>
            <span className="eyebrow hidden sm:inline">
              Powered by ForgeLabs
            </span>
          </Link>
          <div className="flex min-w-0 items-center gap-4">
            <span className="caps hidden max-w-40 truncate sm:block">{session.user.name ?? session.user.email}</span>
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

      <main className="mx-auto w-full max-w-3xl flex-1 px-5 py-6">{children}</main>

      <footer
        className="border-t bg-surface-1"
        style={{ borderColor: "var(--color-line)" }}
      >
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-4 px-5 py-4">
          <span className="eyebrow">Powered by ForgeLabs</span>
          <div className="flex items-center gap-4">
            {admin ? (
              <Link href="/admin" className="caps">
                Admin
              </Link>
            ) : null}
            {scorer ? (
              <Link href="/score" className="caps">
                Scoring
              </Link>
            ) : null}
            {demoMode ? (
              <span className="badge badge-submitted">Demo mode</span>
            ) : null}
          </div>
        </div>
      </footer>
    </div>
  );
}
