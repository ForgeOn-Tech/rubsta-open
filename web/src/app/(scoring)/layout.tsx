import { requireScorer } from "@/auth/require";

export const dynamic = "force-dynamic";

/** Phone-first shell for umpires (design/screens/Scoring.dc.html). */
export default async function ScoringLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireScorer();
  return <div className="min-h-screen bg-surface-0">{children}</div>;
}
