export type NextStepKind =
  | "create-profile"
  | "no-tournament"
  | "entries-closed"
  | "all-events-entered"
  | "enter-first-event"
  | "enter-another-event";

export interface NextStepAction {
  label: string;
  href: string;
}

export interface NextStep {
  kind: NextStepKind;
  title: string;
  description: string;
  action: NextStepAction | null;
}

export interface NextStepInput {
  hasProfile: boolean;
  /** Whether entries are open; null when no tournament exists. */
  entriesOpen: boolean | null;
  enteredCount: number;
  categoryCount: number;
}

const ENTER_EVENT: NextStepAction = { label: "Enter an event", href: "/register" };

/** The one action the player home leads with. */
export function nextStep({
  hasProfile,
  entriesOpen,
  enteredCount,
  categoryCount,
}: NextStepInput): NextStep {
  if (!hasProfile) {
    return {
      kind: "create-profile",
      title: "Create your player profile",
      description:
        "Organisers see your profile with every entry. Add it before you enter an event.",
      action: { label: "Create profile", href: "/profile" },
    };
  }
  if (entriesOpen === null) {
    return {
      kind: "no-tournament",
      title: "No tournament is open yet",
      description: "You can enter here once the next tournament is announced.",
      action: null,
    };
  }
  if (!entriesOpen) {
    return {
      kind: "entries-closed",
      title: "Entries are closed",
      description:
        enteredCount > 0
          ? "Your entries are listed below."
          : "Entries for this tournament have closed.",
      action: null,
    };
  }
  if (enteredCount >= categoryCount) {
    return {
      kind: "all-events-entered",
      title: "You have entered every event",
      description: "Your entries are listed below.",
      action: null,
    };
  }
  if (enteredCount === 0) {
    return {
      kind: "enter-first-event",
      title: "Enter your first event",
      description:
        "Choose singles or doubles. Doubles entries need your partner's name and email.",
      action: ENTER_EVENT,
    };
  }
  const remaining = categoryCount - enteredCount;
  return {
    kind: "enter-another-event",
    title: "Enter another event",
    description: `You can enter ${remaining} more ${remaining === 1 ? "event" : "events"}.`,
    action: ENTER_EVENT,
  };
}

/** First name for the greeting. The profile name wins over the account name. */
export function greetingName(profileName: string | null, accountName: string): string | null {
  const source = (profileName ?? "").trim() || accountName.trim();
  if (!source) return null;
  return source.split(/\s+/)[0];
}

/** Monogram from the first and last name, e.g. "Gaurav Pillai" → "GP". */
export function initials(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "";
  const first = parts[0][0];
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return `${first}${last}`.toUpperCase();
}

export interface UpcomingFeature {
  product: string;
  title: string;
  description: string;
}

/** Copy follows the landing page's technology catalogue. */
export const UPCOMING_FEATURES: readonly UpcomingFeature[] = [
  {
    product: "LiveScore",
    title: "Every point, connected.",
    description:
      "Court-side umpire scoring, live scores, draw and fixture updates, and match statistics.",
  },
  {
    product: "Challenge Kit",
    title: "Put your skills to the test.",
    description:
      "Serve and groundstroke speed, accuracy and reaction challenges, with leaderboards.",
  },
  {
    product: "Fan Zone",
    title: "Bring the crowd into the game.",
    description:
      "Stream-side reactions, chat, fan challenges and leaderboard-only predictions.",
  },
];
