"use client";

import { useEffect, useRef, useState } from "react";

import { STORY_CARD_FILE_NAME, STORY_CARD_THEME_PARAM } from "@/lib/player-card";
import { STORY_PALETTES, STORY_THEMES, type StoryTheme } from "@/lib/story-themes";

export type StoryCard = { kind: "loading" } | { kind: "ready"; file: File; url: string } | { kind: "failed" };

/**
 * The story card at `imagePath` in the picked colour. Each colour's image is fetched when it
 * is picked and kept, so a share sheet can open straight from a tap; Safari refuses a share
 * that waits on a download first.
 */
export function useStoryCard(imagePath: string): { theme: StoryTheme; setTheme: (theme: StoryTheme) => void; card: StoryCard } {
  const [theme, setTheme] = useState<StoryTheme>(STORY_THEMES[0]);
  const [cards, setCards] = useState<Partial<Record<StoryTheme, StoryCard>>>({});
  // Themes already asked for, and the image URLs to free when the page closes.
  const requested = useRef(new Set<StoryTheme>());
  const urls = useRef<string[]>([]);

  useEffect(() => {
    if (requested.current.has(theme)) return;
    requested.current.add(theme);
    fetch(`${imagePath}?${new URLSearchParams({ [STORY_CARD_THEME_PARAM]: theme })}`, { cache: "no-store" })
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
  }, [theme, imagePath]);

  useEffect(() => {
    const kept = urls.current;
    return () => kept.forEach((url) => URL.revokeObjectURL(url));
  }, []);

  return { theme, setTheme, card: cards[theme] ?? { kind: "loading" } };
}

export function StoryCardPreview({ card, alt }: { card: StoryCard; alt: string }) {
  return card.kind === "ready" ? (
    // eslint-disable-next-line @next/next/no-img-element -- a generated, private image
    <img src={card.url} alt={alt} className="w-full border border-club-line" />
  ) : (
    <div className="flex aspect-[9/16] w-full items-center justify-center border border-club-line p-4 text-center text-[13px] text-club-muted" role="status">
      {card.kind === "loading" ? "Making the card…" : "The card could not be made. Reload the page to try again."}
    </div>
  );
}

export function StoryThemePicker({ theme, onPick }: { theme: StoryTheme; onPick: (theme: StoryTheme) => void }) {
  return (
    <fieldset className="flex flex-wrap gap-2">
      <legend className="mb-2 text-[12px] uppercase tracking-[0.12em] text-club-muted">Colour</legend>
      {STORY_THEMES.map((option) => {
        const palette = STORY_PALETTES[option];
        return (
          <label
            key={option}
            className="flex cursor-pointer items-center gap-2 border border-club-line px-3 py-2 text-[13px] has-[:checked]:border-club-ink has-[:focus-visible]:outline has-[:focus-visible]:outline-2"
          >
            <input type="radio" name="story-theme" value={option} checked={option === theme} onChange={() => onPick(option)} className="sr-only" />
            <span aria-hidden className="flex">
              {[palette.background, palette.accent, palette.tiles[2]].map((colour) => (
                <span key={colour} className="-ml-1 h-4 w-4 rounded-full border border-black/10 first:ml-0" style={{ backgroundColor: colour }} />
              ))}
            </span>
            {palette.name}
          </label>
        );
      })}
    </fieldset>
  );
}
