import type { EntryStatus } from "@/db/schema";
import { actionsFor } from "@/lib/entry-status";

export interface EntryStatusActionsProps {
  entryId: string;
  status: EntryStatus;
  /** Who and what the buttons act on, for screen readers, e.g. "Gaurav Pillai, Men's singles". */
  subject: string;
  action: (formData: FormData) => Promise<void>;
}

/** One small form per allowed status change. */
export function EntryStatusActions({ entryId, status, subject, action }: EntryStatusActionsProps) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {actionsFor(status).map((option) => (
        <form key={option.to} action={action}>
          <input type="hidden" name="entryId" value={entryId} />
          <input type="hidden" name="to" value={option.to} />
          <button
            type="submit"
            aria-label={`${option.label}: ${subject}`}
            className="btn btn-outline h-7 px-2.5 text-[11px]"
            style={option.to === "cancelled" ? { color: "var(--color-bad)" } : undefined}
          >
            {option.label}
          </button>
        </form>
      ))}
    </div>
  );
}
