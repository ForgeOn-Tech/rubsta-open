"use client";

import { StoryCardPreview, StoryThemePicker, useStoryCard } from "@/components/story-card-picker";
import { STORY_CARD_FILE_NAME } from "@/lib/player-card";

/** The player's story card as they see it, for admins to check or download. */
export function AdminStoryCard({ imagePath, name, hasPhoto }: { imagePath: string; name: string; hasPhoto: boolean }) {
  const { theme, setTheme, card } = useStoryCard(imagePath);
  return (
    <div className="grid gap-4 px-4 py-3 sm:grid-cols-[minmax(0,200px)_1fr]">
      <div className="mx-auto w-full max-w-[200px]">
        <StoryCardPreview card={card} alt={`${name}'s Instagram story card`} />
      </div>
      <div className="flex flex-col gap-3">
        <StoryThemePicker theme={theme} onPick={setTheme} />
        {card.kind === "ready" ? (
          <a href={card.url} download={STORY_CARD_FILE_NAME} className="btn btn-outline h-8 w-fit text-[12px]">
            Download card ↓
          </a>
        ) : null}
        {hasPhoto ? (
          <p className="text-[12px] text-muted">
            This card uses the player&apos;s own photo. They agreed to it on their profile and their own card, so ask them before
            posting it from the Rubsta account.
          </p>
        ) : null}
      </div>
    </div>
  );
}
