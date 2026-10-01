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
        className="border-b bg-surface-1"
        style={{ borderColor: "var(--color-line)" }}
      >
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-4 px-5 py-4">
          <Link href="/home" className="flex items-baseline gap-3">
            <span className="text-[15px] font-semibold tracking-[-0.01em] text-ink">
              Rubsta Open
            </span>
            <span className="eyebrow hidden sm:inline">
              Tournament OS · Entry
            </span>
          </Link>
          <div className="flex items-center gap-4">
            <span className="caps">{session.user.name ?? session.user.email}</span>
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
