"use server";

import { revalidatePath } from "next/cache";

import { listScorerEmails, requireAdmin } from "@/auth/require";
import { getDb } from "@/db/client";
import { getCurrentTournament } from "@/db/queries";
import {
  ScheduleRejectedError,
  addBlockItem,
  addMatchItem,
  getScheduleItem,
  listScheduleDaysInUse,
  moveItem,
  moveItemToCourt,
  publishDay,
  removeItem,
  updateBlockItem,
  updateMatchItem,
} from "@/db/schedule";
import type { Tournament } from "@/db/schema";
import type { ActionState } from "@/lib/form-state";
import {
  ADMIN_ORDER_OF_PLAY_PATH,
  scheduleDayChoices,
  tournamentDays,
  validateBlock,
  validateTiming,
  type Validation,
} from "@/lib/schedule";

const ITEM_INTENTS = ["save", "up", "down", "court", "remove"] as const;

function field(formData: FormData, name: string): string {
  return String(formData.get(name) ?? "");
}

function failed(error: string): ActionState {
  return { error, savedAt: null };
}

function saved(): ActionState {
  revalidatePath(ADMIN_ORDER_OF_PLAY_PATH);
  return { error: null, savedAt: Date.now() };
}

/** Runs a change and turns a broken order-of-play rule into a message for the admin. */
function attempt(change: () => void): ActionState {
  try {
    change();
  } catch (error) {
    if (error instanceof ScheduleRejectedError) return failed(error.message);
    throw error;
  }
  return saved();
}

function requireTournament(): Tournament {
  const tournament = getCurrentTournament();
  if (!tournament) throw new Error("No tournament has been set up.");
  return tournament;
}

/** The form's day: a day of the tournament, or another day that still has items. */
function dayFrom(formData: FormData, tournament: Tournament): string {
  const day = field(formData, "day");
  const days = scheduleDayChoices(
    tournamentDays(tournament.startsOn, tournament.endsOn),
    listScheduleDaysInUse(getDb(), tournament.id),
  );
  if (!days.includes(day)) throw new Error(`"${day}" is not a day of ${tournament.name}.`);
  return day;
}

/** The chosen court number, or null when none was chosen. */
function courtNumberFrom(formData: FormData): number | null {
  const value = field(formData, "courtNumber");
  if (value === "") return null;
  const courtNumber = Number(value);
  if (!Number.isInteger(courtNumber) || courtNumber < 1) throw new Error(`Unknown court "${value}".`);
  return courtNumber;
}

/** No choice clears the umpire. Anyone else must be able to score, or be assigned already. */
function umpireFrom(formData: FormData, current: string | null): Validation<string | null> {
  const email = field(formData, "umpireEmail").trim().toLowerCase();
  if (email === "") return { ok: true, value: null };
  if (email === current || listScorerEmails().includes(email)) return { ok: true, value: email };
  return { ok: false, error: `${email} is not in UMPIRE_EMAILS or ADMIN_EMAILS.` };
}

export async function addMatchToScheduleAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin();
  const tournament = requireTournament();
  const day = dayFrom(formData, tournament);
  const matchId = field(formData, "matchId");
  if (matchId === "") return failed("Choose a match.");
  const courtNumber = courtNumberFrom(formData);
  if (courtNumber === null) return failed("Choose a court.");
  const timing = validateTiming({ timing: field(formData, "timing"), time: field(formData, "time") });
  if (!timing.ok) return failed(timing.error);
  const umpire = umpireFrom(formData, null);
  if (!umpire.ok) return failed(umpire.error);

  return attempt(() =>
    addMatchItem(getDb(), tournament.id, {
      day,
      courtNumber,
      matchId,
      ...timing.value,
      umpireEmail: umpire.value,
    }),
  );
}

export async function addBlockToScheduleAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin();
  const tournament = requireTournament();
  const day = dayFrom(formData, tournament);
  const courtNumber = courtNumberFrom(formData);
  if (courtNumber === null) return failed("Choose a court.");
  const block = validateBlock({
    title: field(formData, "title"),
    note: field(formData, "note"),
    time: field(formData, "time"),
    endTime: field(formData, "endTime"),
  });
  if (!block.ok) return failed(block.error);

  return attempt(() => addBlockItem(getDb(), tournament.id, { day, courtNumber, block: block.value }));
}

/** One action for every change to an item; the submit button's intent says which. */
export async function changeScheduleItemAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin();
  const database = getDb();
  const item = getScheduleItem(database, field(formData, "itemId"));
  const intent = ITEM_INTENTS.find((value) => value === field(formData, "intent"));
  if (intent === undefined) {
    throw new Error(`Unknown change "${field(formData, "intent")}" for schedule item ${item.id}.`);
  }

  switch (intent) {
    case "up":
    case "down":
      moveItem(database, item.id, intent);
      return saved();
    case "remove":
      removeItem(database, item.id);
      return saved();
    case "court": {
      const courtNumber = courtNumberFrom(formData);
      if (courtNumber === null) return failed("Choose a court.");
      return attempt(() => moveItemToCourt(database, item.id, courtNumber));
    }
    case "save": {
      if (item.kind === "block") {
        const block = validateBlock({
          title: field(formData, "title"),
          note: field(formData, "note"),
          time: field(formData, "time"),
          endTime: field(formData, "endTime"),
        });
        if (!block.ok) return failed(block.error);
        updateBlockItem(database, item.id, block.value);
        return saved();
      }
      const timing = validateTiming({ timing: field(formData, "timing"), time: field(formData, "time") });
      if (!timing.ok) return failed(timing.error);
      const umpire = umpireFrom(formData, item.umpireEmail);
      if (!umpire.ok) return failed(umpire.error);
      updateMatchItem(database, item.id, { ...timing.value, umpireEmail: umpire.value });
      return saved();
    }
  }
}

/** Shows umpires the day's order of play as it stands now. */
export async function publishDayAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const tournament = requireTournament();
  publishDay(getDb(), tournament.id, dayFrom(formData, tournament));
  revalidatePath("/score", "layout");
  return saved();
}
