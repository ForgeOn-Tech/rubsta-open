"use client";

import { useEffect, useRef, useState } from "react";

import { STORY_CARD_FILE_NAME, STORY_CARD_IMAGE_PATH, STORY_CARD_THEME_PARAM } from "@/lib/player-card";
import { STORY_PALETTES, STORY_THEMES, type StoryTheme } from "@/lib/story-themes";

type Card = { kind: "loading" } | { kind: "ready"; file: File; url: string } | { kind: "failed" };
type Outcome = "idle" | "shared" | "saved";

function cardPath(theme: StoryTheme): string {
  return `${STORY_CARD_IMAGE_PATH}?${new URLSearchParams({ [STORY_CARD_THEME_PARAM]: theme })}`;
}

/**
 * The Instagram story card: a colour picker, a preview, and one button to share or save it.
 * Each colour's image is fetched when it is picked and kept, so the share sheet opens
 * straight from the tap; Safari refuses a share that waits on a download first.
 */
export function StoryShare({ name }: { name: string }) {
  const [theme, setTheme] = useState<StoryTheme>(STORY_THEMES[0]);
  const [cards, setCards] = useState<Partial<Record<StoryTheme, Card>>>({});
  const [outcome, setOutcome] = useState<Outcome>("idle");
  const card = cards[theme] ?? { kind: "loading" };

  // Themes already asked for, and the image URLs to free when the page closes.
  const requested = useRef(new Set<StoryTheme>());
  const urls = useRef<string[]>([]);

  useEffect(() => {
    if (requested.current.has(theme)) return;
    requested.current.add(theme);
    fetch(cardPath(theme), { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error(`The story card returned status ${response.status}.`);
        const blob = await response.blob();
        const file = new File([blob], STORY_CARD_FILE_NAME, { type: blob.type });
        const url = URL.createObjectURL(blob);
        urls.current.push(url);
        setCards((current) => ({ ...current, [theme]: { kind: "ready", file, url } }));
      })
      .catch((error: unknown) => {
        console.warn("The story card could not be made.", error);
        requested.current.delete(theme);
        setCards((current) => ({ ...current, [theme]: { kind: "failed" } }));
      });
  }, [theme]);

  useEffect(() => {
    const kept = urls.current;
    return () => kept.forEach((url) => URL.revokeObjectURL(url));
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
          Your story card shows your tag, earned from how your matches went, and your best numbers from matches
          scored point by point. It updates as you play.
        </p>
        <fieldset className="flex flex-wrap gap-2">
          <legend className="mb-2 text-[12px] uppercase tracking-[0.12em] text-club-muted">Colour</legend>
          {STORY_THEMES.map((option) => {
            const palette = STORY_PALETTES[option];
            return (
              <label
                key={option}
                className="flex cursor-pointer items-center gap-2 border border-club-line px-3 py-2 text-[13px] has-[:checked]:border-club-ink has-[:focus-visible]:outline has-[:focus-visible]:outline-2"
              >
                <input
                  type="radio"
                  name="story-theme"
                  value={option}
                  checked={option === theme}
                  onChange={() => {
                    setTheme(option);
                    setOutcome("idle");
                  }}
                  className="sr-only"
                />
                <span aria-hidden className="flex">
                  {[palette.background, palette.accent, palette.tiles[2]].map((colour) => (
                    <span key={colour} className="h-4 w-4 rounded-full border border-black/10 -ml-1 first:ml-0" style={{ backgroundColor: colour }} />
                  ))}
                </span>
                {palette.name}
              </label>
            );
          })}
        </fieldset>
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
