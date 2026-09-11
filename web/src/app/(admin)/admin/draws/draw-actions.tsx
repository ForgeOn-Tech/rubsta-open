"use client";

import { useActionState } from "react";

import type { DrawStatus } from "@/db/schema";
import { INITIAL_ACTION_STATE, type FormAction } from "@/lib/form-state";

export interface DrawActionsProps {
  category: string;
  drawId: string | null;
  status: DrawStatus | null;
  canGenerate: boolean;
  generateAction: FormAction;
  statusAction: FormAction;
}

const BUTTON = "btn h-8 text-[12px]";

export function DrawActions({
  category,
  drawId,
  status,
  canGenerate,
  generateAction,
  statusAction,
}: DrawActionsProps) {
  const [generateState, generate, generating] = useActionState(generateAction, INITIAL_ACTION_STATE);
  const [statusState, changeStatus, changing] = useActionState(statusAction, INITIAL_ACTION_STATE);

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex flex-wrap gap-2">
        {status !== "published" && canGenerate ? (
          <form action={generate}>
            <input type="hidden" name="category" value={category} />
            <button type="submit" className={`${BUTTON} btn-outline`} disabled={generating}>
              {generating ? "Generating…" : status === "draft" ? "Generate again" : "Generate draw"}
            </button>
          </form>
        ) : null}
        {drawId && status === "draft" ? (
          <form action={changeStatus}>
            <input type="hidden" name="drawId" value={drawId} />
            <input type="hidden" name="to" value="published" />
            <button type="submit" className={`${BUTTON} btn-primary`} disabled={changing}>
              Publish draw
            </button>
          </form>
        ) : null}
        {drawId && status === "published" ? (
          <form action={changeStatus}>
            <input type="hidden" name="drawId" value={drawId} />
            <input type="hidden" name="to" value="draft" />
            <button type="submit" className={`${BUTTON} btn-outline`} disabled={changing}>
              Back to draft
            </button>
          </form>
        ) : null}
      </div>
      {generateState.error ? (
        <p className="max-w-sm text-right text-[12px] text-bad" role="alert">
          {generateState.error}
        </p>
      ) : null}
      {statusState.error ? (
        <p className="max-w-sm text-right text-[12px] text-bad" role="alert">
          {statusState.error}
        </p>
      ) : null}
    </div>
  );
}
