import Link from "next/link";
import { requireUser } from "@/auth/require";
import { getDb } from "@/db/client";
import { getPlayerCard, getPlayerCardShare } from "@/db/player-cards";
import { PlayerRecord } from "@/components/player-record";
import { ShareControls } from "./share-controls";
import { StoryShare } from "./story-share";
export default async function PlayerCardPage() {
  const user = await requireUser();
  const card = getPlayerCard(getDb(), user.id);
  return <div className="mx-auto w-full max-w-3xl"><Link href="/home" className="mb-7 inline-block">← Back to player home</Link>
    {card ? <><StoryShare name={card.name} /><ShareControls token={getPlayerCardShare(getDb(), user.id)?.token ?? null} /><PlayerRecord card={card} /></> : <div><h1 className="font-serif text-4xl">Create your player card</h1><p className="mt-4">Complete your profile to see your card.</p><Link href="/profile" className="pill pill-primary mt-5">Complete profile</Link></div>}
  </div>;
}
