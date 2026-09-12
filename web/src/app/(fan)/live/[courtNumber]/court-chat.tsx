"use client";

import Link from "next/link";
import { useActionState } from "react";

import type { ChatMessage } from "@/db/fan";
import { MAX_FAN_MESSAGE_LENGTH, fanInitials } from "@/lib/fan-chat";
import { INITIAL_ACTION_STATE, type FormAction } from "@/lib/form-state";
import { venueClock } from "@/lib/schedule";

export interface CourtChatProps {
  courtNumber: number;
  messages: readonly ChatMessage[];
  signedIn: boolean;
  action: FormAction;
}

/** One court's chat: what fans have said, and the box to say something. */
export function CourtChat({ courtNumber, messages, signedIn, action }: CourtChatProps) {
  const [state, formAction, pending] = useActionState(action, INITIAL_ACTION_STATE);

  return (
    <section aria-labelledby="chat-heading" className="flex flex-col gap-3">
      <h2 id="chat-heading" className="text-[11px] font-medium uppercase tracking-[1.5px] text-club-mist/60">
        Court chat
      </h2>

      {messages.length === 0 ? (
        <p className="text-[13px] text-club-mist/60">No messages yet. Say something.</p>
      ) : (
        <ol className="flex flex-col">
          {messages.map((message) => (
            <li key={message.id} className="flex gap-3 border-b border-club-mist/15 py-2.5">
              <span
                aria-hidden="true"
                className="flex h-8 w-8 flex-none items-center justify-center bg-club-mist/15 text-[11px]"
              >
                {fanInitials(message.name)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline gap-2">
                  <span className="text-[12px] font-semibold">{message.name}</span>
                  <span className="text-[10px] lining-nums text-club-mist/50">
                    {venueClock(message.createdAt)}
                  </span>
                </span>
                <span className="mt-0.5 block break-words text-[13px] text-club-mist/80">
                  {message.body}
                </span>
              </span>
            </li>
          ))}
        </ol>
      )}

      {signedIn ? (
        <form action={formAction} className="flex gap-2.5">
          <input type="hidden" name="courtNumber" value={courtNumber} />
          {/* A new key after each message empties the box; an error keeps what was typed. */}
          <input
            key={state.savedAt ?? 0}
            name="body"
            aria-label="Message"
            maxLength={MAX_FAN_MESSAGE_LENGTH}
            placeholder="Say something…"
            className="h-12 min-w-0 flex-1 border border-club-mist/25 bg-transparent px-3.5 text-[13px] placeholder:text-club-mist/40"
          />
          <button
            type="submit"
            disabled={pending}
            className="h-12 flex-none cursor-pointer bg-club-lime px-5 text-[12px] font-semibold uppercase tracking-[1.5px] text-club-forest disabled:cursor-wait"
          >
            {pending ? "Sending…" : "Send"}
          </button>
        </form>
      ) : (
        <p className="text-[12px]">
          <Link href="/signin" className="underline">
            Sign in
          </Link>{" "}
          to join the chat.
        </p>
      )}

      {state.error ? (
        <p className="text-[12px] text-club-lime" role="alert">
          {state.error}
        </p>
      ) : null}
    </section>
  );
}
