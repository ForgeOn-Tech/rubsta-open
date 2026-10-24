"use client";

import { useState } from "react";

import { StoryCardPreview, StoryThemePicker, useStoryCard } from "@/components/story-card-picker";
import { STORY_CARD_FILE_NAME, STORY_CARD_IMAGE_PATH } from "@/lib/player-card";

type Outcome = "idle" | "shared" | "saved";

/** The player's Instagram story card: a colour picker, a preview, and one button to share or save it. */
export function StoryShare({ name }: { name: string }) {
  const { theme, setTheme, card } = useStoryCard(STORY_CARD_IMAGE_PATH);
  const [outcome, setOutcome] = useState<Outcome>("idle");

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
        <StoryCardPreview card={card} alt={`${name}'s Instagram story card`} />
      </div>
      <div className="flex flex-col gap-3">
        <h2 id="story-heading" className="font-serif text-3xl">Share your Rubsta Open</h2>
        <p className="text-[14px]">
          Your story card shows your tag, earned from how your matches went, and your best numbers from matches
          scored point by point. It updates as you play.
        </p>
        <StoryThemePicker
          theme={theme}
          onPick={(picked) => {
            setTheme(picked);
            setOutcome("idle");
          }}
        />
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
