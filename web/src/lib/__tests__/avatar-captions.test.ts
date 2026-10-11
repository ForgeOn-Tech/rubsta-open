import { expect, it, vi } from "vitest";
import { AVATAR_CAPTION_COUNT, avatarCaptionAt, suggestAvatarCaption } from "../avatar-captions";
import { AVATAR_MAX_QUOTE } from "../avatar";

it("has distinct suggestions that all fit on the card without truncation", () => {
  const captions = Array.from({ length: AVATAR_CAPTION_COUNT }, (_, i) => avatarCaptionAt(i));
  expect(new Set(captions).size).toBe(AVATAR_CAPTION_COUNT);
  expect(captions.every(caption => caption.length <= AVATAR_MAX_QUOTE)).toBe(true);
});

it("does not repeat suggestions even if random selection repeatedly lands on the same number", () => {
  const random = vi.spyOn(Math, "random").mockReturnValue(0);
  try {
    const captions = Array.from({ length: 50 }, () => suggestAvatarCaption());
    expect(new Set(captions).size).toBe(50);
    expect(JSON.parse(localStorage.getItem("rubsta-avatar-caption-history-v1")!).length).toBeGreaterThanOrEqual(50);
  } finally { random.mockRestore(); }
});
