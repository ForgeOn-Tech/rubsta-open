"use server";

import { revalidatePath } from "next/cache";

import { listScorerEmails, requireAdmin } from "@/auth/require";
import { applyFill, previewFill, type FillPreview } from "@/db/auto-schedule";
import { getDb } from "@/db/client";
import { listCourts } from "@/db/courts";
import { ScoreRejectedError, walkoverMatch } from "@/db/matches";
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
import { validateFillRequest, type FillValidation } from "@/lib/auto-schedule";
import type { ActionState } from "@/lib/form-state";
import { SIDES } from "@/lib/match";
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

/** Records a walkover from the order of play: the chosen side did not turn up. */
export async function walkoverAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const absentSide = SIDES.find((side) => side === field(formData, "absentSide"));
  if (absentSide === undefined) return failed("Choose who did not play.");
  try {
    walkoverMatch(getDb(), field(formData, "matchId"), absentSide);
  } catch (error) {
    if (error instanceof ScoreRejectedError) return failed(error.message);
    throw error;
  }
  // Draws, results, scoring and the Fan Zone all show the result.
  revalidatePath("/", "layout");
  return { error: null, savedAt: Date.now() };
}

export interface FillState {
  error: string | null;
  preview: FillPreview | null;
  /** How many matches the last fill added, or null before one. */
  added: number | null;
}

function fillRequestFrom(formData: FormData, tournament: Tournament): FillValidation {
  const text = (name: string) => String(formData.get(name) ?? "");
  return validateFillRequest(
    {
      day: text("day"),
      courts: formData.getAll("courts").map(String),
      startTime: text("startTime"),
      restMinutes: text("restMinutes"),
      oneSet: text("oneSet"),
      eightGames: text("eightGames"),
      bestOfThree: text("bestOfThree"),
      rounds: formData.getAll("rounds").map(String),
    },
    scheduleDayChoices(tournamentDays(tournament.startsOn, tournament.endsOn), listScheduleDaysInUse(getDb(), tournament.id)),
    listCourts(getDb(), tournament.id).map((court) => court.number),
  );
}

/**
 * The fill form's buttons: "preview" shows what a fill would place and changes nothing; "apply"
 * adds it to the working order of play, which umpires see once the day is published.
 */
export async function fillScheduleAction(_previous: FillState, formData: FormData): Promise<FillState> {
  await requireAdmin();
  const tournament = getCurrentTournament();
  if (!tournament) return { error: "No tournament has been set up.", preview: null, added: null };
  const request = fillRequestFrom(formData, tournament);
  if (!request.ok) return { error: request.error, preview: null, added: null };
  if (formData.get("intent") !== "apply") {
    return { error: null, preview: previewFill(getDb(), tournament.id, request.request), added: null };
  }
  try {
    const added = applyFill(getDb(), tournament.id, request.request);
    revalidatePath(ADMIN_ORDER_OF_PLAY_PATH);
    return { error: null, preview: null, added };
  } catch (error) {
    if (error instanceof ScheduleRejectedError) return { error: error.message, preview: null, added: null };
    throw error;
  }
}
