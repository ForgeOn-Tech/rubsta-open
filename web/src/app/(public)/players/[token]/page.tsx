import { notFound } from "next/navigation";
import { getDb } from "@/db/client";
import { getPlayerCard, sharedCardOwner } from "@/db/player-cards";
import { PlayerRecord } from "@/components/player-record";
export const dynamic = "force-dynamic";
export const metadata = { title: "Player Card · Rubsta Open", robots: { index: false, follow: false } };
export default async function SharedPlayerCard({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const userId = sharedCardOwner(getDb(), token);
  if (!userId) notFound();
  const card = getPlayerCard(getDb(), userId);
  if (!card) notFound();
  return <div className="mx-auto max-w-3xl"><PlayerRecord card={card} token={token} /></div>;
}
