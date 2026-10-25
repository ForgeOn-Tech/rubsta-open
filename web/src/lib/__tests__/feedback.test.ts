import { describe, expect, it } from "vitest";

import { FEEDBACK_OPENS_AT, FEEDBACK_TOPICS, FeedbackError, MAX_COMMENT_LENGTH, isFeedbackOpen, parseFeedback, summarizeFeedback } from "@/lib/feedback";

function fields(values: Record<string, string>) {
  return (name: string) => values[name] ?? null;
}

describe("parseFeedback", () => {
  it("keeps rated topics and leaves out skipped and unanswered ones", () => {
    const input = parseFeedback(fields({ "rating-venue": "4", "rating-overall": "5", "rating-fanZone": "", comment: "  Great courts. " }));
    expect(input).toEqual({ ratings: { venue: 4, overall: 5 }, comment: "Great courts." });
  });

  it("stores an empty comment as none", () => {
    expect(parseFeedback(fields({ "rating-overall": "3", comment: "   " })).comment).toBeNull();
  });

  it("asks for at least one rating", () => {
    expect(() => parseFeedback(fields({ "rating-venue": "", comment: "Hello" }))).toThrow("Rate at least one part");
  });

  it.each(["0", "6", "4.5", "five"])("refuses %s stars", (value) => {
    expect(() => parseFeedback(fields({ "rating-venue": value }))).toThrow(FeedbackError);
  });

  it("accepts a comment at the length limit and refuses a longer one", () => {
    const limit = "a".repeat(MAX_COMMENT_LENGTH);
    expect(parseFeedback(fields({ "rating-overall": "5", comment: limit })).comment).toBe(limit);
    expect(() => parseFeedback(fields({ "rating-overall": "5", comment: limit + "a" }))).toThrow(FeedbackError);
  });
});

describe("summarizeFeedback", () => {
  it("averages each topic over the responses that rated it", () => {
    const venue = summarizeFeedback([{ venue: 5 }, { venue: 2, overall: 4 }, { overall: 4 }])
      .find((topic) => topic.key === "venue");
    expect(venue).toMatchObject({ count: 2, average: 3.5, stars: [0, 1, 0, 0, 1] });
  });

  it("lists every topic in form order, unrated ones with no average", () => {
    const summary = summarizeFeedback([]);
    expect(summary.map((topic) => topic.key)).toEqual(FEEDBACK_TOPICS.map((topic) => topic.key));
    expect(summary.every((topic) => topic.count === 0 && topic.average === null)).toBe(true);
  });
});

describe("isFeedbackOpen", () => {
  it("opens at 6:00 pm IST on 26 October 2026, which is 12:30 UTC", () => {
    expect(new Date(FEEDBACK_OPENS_AT).toISOString()).toBe("2026-10-26T12:30:00.000Z");
  });

  it("is closed a moment before the opening time and open from it onwards", () => {
    expect(isFeedbackOpen(FEEDBACK_OPENS_AT - 1)).toBe(false);
    expect(isFeedbackOpen(FEEDBACK_OPENS_AT)).toBe(true);
  });
});
