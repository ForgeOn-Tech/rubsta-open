import { notFound } from "next/navigation";
import { courtOverlay } from "@/db/overlay";
import { ScoreOverlay } from "./score-overlay";
import "./overlay.css";

export const dynamic = "force-dynamic";
export const metadata = { title: "Rubsta Open · OBS scoreboard", robots: { index: false, follow: false } };

export default async function OverlayPage({ params }: { params: Promise<{ courtNumber: string }> }) {
  const data = courtOverlay((await params).courtNumber);
  if (!data) notFound();
  return <ScoreOverlay initial={data} />;
}
