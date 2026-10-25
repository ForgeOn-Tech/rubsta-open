"use client";

import { useActionState, useState } from "react";

import {
  COMMENT_FIELD,
  FEEDBACK_TOPICS,
  type FeedbackRatings,
  type FeedbackTopic,
  MAX_COMMENT_LENGTH,
  MAX_STARS,
  NOT_USED,
  RATING_FIELD_PREFIX,
} from "@/lib/feedback";
import { INITIAL_ACTION_STATE } from "@/lib/form-state";

import { sendFeedback } from "./actions";

const STAR_VALUES = Array.from({ length: MAX_STARS }, (_, index) => index + 1);
/** Shows keyboard focus on a label whose radio is visually hidden. */
const FOCUS_RING = "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-club-deep";

/** null: nothing chosen yet, which counts the same as "Didn't use". */
type Choice = number | typeof NOT_USED | null;

function starLabel(stars: number): string {
  return stars === 1 ? "1 star" : `${stars} stars`;
}

function TopicRating({ topic, label, choice, onChoose }: {
  topic: FeedbackTopic;
  label: string;
  choice: Choice;
  onChoose: (choice: Choice) => void;
}) {
  const name = RATING_FIELD_PREFIX + topic;
  const stars = typeof choice === "number" ? choice : 0;
  return <fieldset className="border-b border-club-line py-4">
    <legend className="float-left w-full font-medium">{label}</legend>
    <div className="clear-both flex items-center gap-1 pt-2">
      {STAR_VALUES.map((value) => <label key={value}
        className={`cursor-pointer px-0.5 text-[30px] leading-none ${FOCUS_RING}`}
        style={{ color: value <= stars ? "var(--color-club-deep)" : "var(--color-club-line)" }}>
        <input type="radio" name={name} value={value} checked={choice === value}
          onChange={() => onChoose(value)} className="sr-only" />
        <span aria-hidden="true">★</span>
        <span className="sr-only">{starLabel(value)}</span>
      </label>)}
      <label className={`ml-auto shrink-0 cursor-pointer rounded-full border px-3 py-1.5 text-[10px] font-medium uppercase tracking-[1px] ${FOCUS_RING}`}
        style={choice === NOT_USED
          ? { background: "var(--color-club-deep)", borderColor: "var(--color-club-deep)", color: "var(--color-club-cream)" }
          : { borderColor: "var(--color-club-line)" }}>
        <input type="radio" name={name} value={NOT_USED} checked={choice === NOT_USED}
          onChange={() => onChoose(NOT_USED)} className="sr-only" />
        Didn&rsquo;t use
      </label>
    </div>
  </fieldset>;
}

export function FeedbackForm({ initialRatings, initialComment }: {
  initialRatings: FeedbackRatings;
  initialComment: string;
}) {
  const [state, action, pending] = useActionState(sendFeedback, INITIAL_ACTION_STATE);
  const [choices, setChoices] = useState<Partial<Record<FeedbackTopic, Choice>>>(initialRatings);
  const [comment, setComment] = useState(initialComment);

  return <form action={action} className="mt-8">
    {FEEDBACK_TOPICS.map((topic) => <TopicRating key={topic.key} topic={topic.key} label={topic.label}
      choice={choices[topic.key] ?? null}
      onChoose={(choice) => setChoices((current) => ({ ...current, [topic.key]: choice }))} />)}

    <label className="mt-6 block font-medium">
      Anything else? <span className="font-normal text-club-muted">(optional)</span>
      <textarea name={COMMENT_FIELD} value={comment} onChange={(event) => setComment(event.target.value)}
        maxLength={MAX_COMMENT_LENGTH} rows={4}
        className="mt-2 block w-full border border-club-line bg-white/60 px-3 py-2 font-normal" />
    </label>

    {state.error ? <p role="alert" className="mt-4 text-bad">{state.error}</p> : null}
    {!state.error && state.savedAt ? <p role="status" className="mt-4">
      Thank you. Your feedback is saved. You can change it here at any time.
    </p> : null}
    <button type="submit" disabled={pending} className="pill pill-primary mt-6 disabled:opacity-50">
      {pending ? "Sending…" : "Send feedback"}
    </button>
  </form>;
}
