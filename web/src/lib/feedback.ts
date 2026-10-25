/** The parts of the tournament people rate, in the order the form shows them. */
export const FEEDBACK_TOPICS = [
  { key: "registration", label: "Registration and payment" },
  { key: "updates", label: "Updates before the tournament" },
  { key: "draws", label: "Draws and order of play" },
  { key: "timing", label: "Matches starting on time" },
  { key: "venue", label: "Venue and courts" },
  { key: "umpiring", label: "Umpires and scoring" },
  { key: "app", label: "Live scores and the app" },
  { key: "fanZone", label: "Fan Zone and live stream" },
  { key: "hospitality", label: "Food, water and seating" },
  { key: "prizes", label: "Prizes and certificates" },
  { key: "overall", label: "Overall" },
] as const;

export type FeedbackTopic = (typeof FEEDBACK_TOPICS)[number]["key"];
/** Only rated topics appear; a topic someone did not use is left out. */
export type FeedbackRatings = Partial<Record<FeedbackTopic, number>>;

export const MIN_STARS = 1;
export const MAX_STARS = 5;
export const MAX_COMMENT_LENGTH = 1000;
/** The form field for a topic's rating. */
export const RATING_FIELD_PREFIX = "rating-";
export const COMMENT_FIELD = "comment";
/** The value of the "Didn't use" choice. */
export const NOT_USED = "";

export class FeedbackError extends Error {}

export interface FeedbackInput {
  ratings: FeedbackRatings;
  comment: string | null;
}

export interface TopicSummary {
  key: FeedbackTopic;
  label: string;
  /** How many responses rated this topic. */
  count: number;
  /** null when nobody rated the topic. */
  average: number | null;
  /** Responses per star, from 1 star to 5 stars. */
  stars: number[];
}

function parseStars(topic: string, value: string): number {
  const stars = Number(value);
  if (!Number.isInteger(stars) || stars < MIN_STARS || stars > MAX_STARS) {
    throw new FeedbackError(`Choose 1 to 5 stars for ${topic}, or "Didn't use".`);
  }
  return stars;
}

/** Reads the form fields; a missing or "Didn't use" field leaves that topic unrated. */
export function parseFeedback(fields: (name: string) => string | null): FeedbackInput {
  const ratings: FeedbackRatings = {};
  for (const topic of FEEDBACK_TOPICS) {
    const value = fields(RATING_FIELD_PREFIX + topic.key);
    if (value === null || value === NOT_USED) continue;
    ratings[topic.key] = parseStars(topic.label, value);
  }
  if (Object.keys(ratings).length === 0) throw new FeedbackError("Rate at least one part of the tournament.");

  const comment = (fields(COMMENT_FIELD) ?? "").trim();
  if (comment.length > MAX_COMMENT_LENGTH) {
    throw new FeedbackError(`Keep the comment under ${MAX_COMMENT_LENGTH} characters.`);
  }
  return { ratings, comment: comment === "" ? null : comment };
}

/** Average, count and star spread for each topic, in form order. */
export function summarizeFeedback(responses: readonly FeedbackRatings[]): TopicSummary[] {
  return FEEDBACK_TOPICS.map((topic) => {
    const given = responses.map((ratings) => ratings[topic.key]).filter((stars) => stars !== undefined);
    const stars = Array.from({ length: MAX_STARS }, (_, index) => given.filter((value) => value === index + 1).length);
    const total = given.reduce((sum, value) => sum + value, 0);
    return {
      key: topic.key,
      label: topic.label,
      count: given.length,
      average: given.length === 0 ? null : total / given.length,
      stars,
    };
  });
}
