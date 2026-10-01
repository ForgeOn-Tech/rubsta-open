"use client";

import { useActionState } from "react";

import type { ModeratedMessage } from "@/db/fan";
import { INITIAL_ACTION_STATE, type FormAction } from "@/lib/form-state";
import { courtTitle, venueClock } from "@/lib/schedule";

export interface MessageRowProps {
  message: ModeratedMessage;
  hideAction: FormAction;
  showAction: FormAction;
  muteAction: FormAction;
  unmuteAction: FormAction;
}

const SMALL_BUTTON = "btn btn-outline h-9 text-[12px]";

/** One chat message with the two things an admin can do about it. */
export function MessageRow({ message, hideAction, showAction, muteAction, unmuteAction }: MessageRowProps) {
  const hidden = message.hiddenAt !== null;
  const [visibilityState, changeVisibility, changingVisibility] = useActionState(
    hidden ? showAction : hideAction,
    INITIAL_ACTION_STATE,
  );
  const [muteState, changeMute, changingMute] = useActionState(
    message.muted ? unmuteAction : muteAction,
    INITIAL_ACTION_STATE,
  );
  const error = visibilityState.error ?? muteState.error;

  return (
    <tr className="border-b border-line last:border-b-0">
      <td className="mono px-4 py-3 text-muted">{venueClock(message.createdAt)}</td>
      <td className="px-4 py-3">{courtTitle(message.courtNumber)}</td>
      <td className="px-4 py-3">
        <div className="font-medium">{message.name}</div>
        <div className="text-[12px] text-muted">{message.email}</div>
      </td>
      <td className="px-4 py-3">
        <span className={hidden ? "text-muted line-through" : ""}>{message.body}</span>
        {error ? (
          <p className="mt-1 text-[12px] text-bad" role="alert">
            {error}
          </p>
        ) : null}
      </td>
      <td className="px-4 py-3">
        <div className="flex flex-wrap gap-2">
          <form action={changeVisibility}>
            <input type="hidden" name="messageId" value={message.id} />
            <button type="submit" className={SMALL_BUTTON} disabled={changingVisibility}>
              {hidden ? "Show" : "Hide"}
            </button>
          </form>
          <form action={changeMute}>
            <input type="hidden" name="userId" value={message.userId} />
            <button type="submit" className={SMALL_BUTTON} disabled={changingMute}>
              {message.muted ? "Unmute" : "Mute"}
            </button>
          </form>
        </div>
      </td>
    </tr>
  );
}
