"use client";

import { useEffect, useState } from "react";

import { STORY_CARD_FILE_NAME, STORY_CARD_IMAGE_PATH } from "@/lib/player-card";

type Card = { kind: "loading" } | { kind: "ready"; file: File; url: string } | { kind: "failed" };
type Outcome = "idle" | "shared" | "saved";

/**
 * The Instagram story card: a preview, and one button to share or save it. The image is
 * fetched when the page opens, so the share sheet opens straight from the tap; Safari
 * refuses a share that waits on a download first.
 */
export function StoryShare({ name }: { name: string }) {
  const [card, setCard] = useState<Card>({ kind: "loading" });
  const [outcome, setOutcome] = useState<Outcome>("idle");

  useEffect(() => {
    let url: string | null = null;
    let cancelled = false;
    fetch(STORY_CARD_IMAGE_PATH, { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error(`The story card returned status ${response.status}.`);
        const blob = await response.blob();
        if (cancelled) return;
        url = URL.createObjectURL(blob);
        setCard({ kind: "ready", file: new File([blob], STORY_CARD_FILE_NAME, { type: blob.type }), url });
      })
      .catch((error: unknown) => {
        console.warn("The story card could not be made.", error);
        if (!cancelled) setCard({ kind: "failed" });
      });
    return () => {
      cancelled = true;
      if (url !== null) URL.revokeObjectURL(url);
    };
  }, []);

  async function share(file: File, url: string) {
    if (typeof navigator.canShare === "function" && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: `${name} · Rubsta Open` });
        setOutcome("shared");
      } catch (error) {
        // Closing the share sheet is the player's choice, not a failure.
        if (!(error instanceof DOMException && error.name === "AbortError")) console.warn("Sharing the story card failed.", error);
      }
      return;
    }
    const link = document.createElement("a");
    link.href = url;
    link.download = STORY_CARD_FILE_NAME;
    link.click();
    setOutcome("saved");
  }

  return (
    <section aria-labelledby="story-heading" className="mb-10 grid gap-6 border-b border-club-line pb-10 sm:grid-cols-[minmax(0,260px)_1fr]">
      <div className="mx-auto w-full max-w-[260px]">
        {card.kind === "ready" ? (
          // eslint-disable-next-line @next/next/no-img-element -- a generated, private image
          <img src={card.url} alt={`${name}'s Instagram story card`} className="w-full border border-club-line" />
        ) : (
          <div className="flex aspect-[9/16] w-full items-center justify-center border border-club-line p-4 text-center text-[13px] text-club-muted" role="status">
            {card.kind === "loading" ? "Making your card…" : "Your card could not be made. Reload the page to try again."}
          </div>
        )}
      </div>
      <div className="flex flex-col gap-3">
        <h2 id="story-heading" className="font-serif text-3xl">Share your Rubsta Open</h2>
        <p className="text-[14px]">
          Your story card shows your tag, earned from how your matches went. It updates as you play.
        </p>
        <button
          type="button"
          className="pill pill-primary w-fit"
          disabled={card.kind !== "ready"}
          onClick={() => card.kind === "ready" && void share(card.file, card.url)}
        >
          Share to Instagram
        </button>
        {outcome === "idle" ? null : (
          <p role="status" className="text-[12px] text-club-muted">
            {outcome === "shared" ? "Shared." : "Saved to your device. Open Instagram, add a story and pick the image."}
          </p>
        )}
        <p className="text-[12px] text-club-muted">
          On a phone, the button opens your share options; choose Instagram, then Story. Add your photo in your{" "}
          <a href="/profile" className="underline">profile</a>.
        </p>
      </div>
    </section>
  );
}
