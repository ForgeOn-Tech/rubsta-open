"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { requireAdmin } from "@/auth/require";
import { getDb } from "@/db/client";
import { getDrawWithSlots, saveGeneratedDraw, saveSeeds, setDrawStatus } from "@/db/draws";
import { getCurrentTournament, listTournamentEntries } from "@/db/queries";
import { draws, type Category } from "@/db/schema";
import { parseCategoryFilter } from "@/lib/admin-entries";
import {
  MIN_DRAW_ENTRANTS,
  canDraw,
  drawChanges,
  drawSize,
  eligibleRows,
  generateDraw,
  hasDrawChanges,
  parseSeedInput,
  toDrawEntrant,
  validateSeeds,
} from "@/lib/draws";
import type { ActionState } from "@/lib/form-state";

const NOT_ENOUGH_ENTRANTS = `A draw needs ${MIN_DRAW_ENTRANTS} to 128 confirmed or paid entries.`;

function failed(error: string): ActionState {
  return { error, savedAt: null };
}

function saved(): ActionState {
  revalidatePath("/admin", "layout");
  return { error: null, savedAt: Date.now() };
}

function categoryFrom(formData: FormData): Category {
  const value = String(formData.get("category") ?? "");
  const category = parseCategoryFilter(value);
  if (!category) throw new Error(`Unknown event "${value}".`);
  return category;
}

function requireTournamentId(): string {
  const tournament = getCurrentTournament();
  if (!tournament) throw new Error("No tournament has been set up.");
  return tournament.id;
}

export async function saveDrawSeeds(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const category = categoryFrom(formData);
  const tournamentId = requireTournamentId();
  const database = getDb();

  if (getDrawWithSlots(database, tournamentId, category)?.draw.status === "published") {
    return failed("Move the draw back to draft before changing seeds.");
  }
  const eligible = eligibleRows(listTournamentEntries(tournamentId), category);
  if (!canDraw(eligible.length)) return failed(NOT_ENOUGH_ENTRANTS);

  const seeds = eligible.map((row) => ({
    entryId: row.entry.id,
    seed: parseSeedInput(String(formData.get(`seed-${row.entry.id}`) ?? "")),
  }));
  const check = validateSeeds(
    seeds.map((item) => item.seed),
    drawSize(eligible.length),
  );
  if (!check.ok) return failed(check.error);

  saveSeeds(database, tournamentId, category, seeds);
  return saved();
}

export async function generateDrawAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin();
  const category = categoryFrom(formData);
  const tournamentId = requireTournamentId();
  const database = getDb();

  if (getDrawWithSlots(database, tournamentId, category)?.draw.status === "published") {
    return failed("Move the draw back to draft before generating it again.");
  }
  const entrants = eligibleRows(listTournamentEntries(tournamentId), category).map(toDrawEntrant);
  if (!canDraw(entrants.length)) return failed(NOT_ENOUGH_ENTRANTS);

  // Seeds can go stale, e.g. when a seeded entry is cancelled after seeding.
  const check = validateSeeds(
    entrants.map((entrant) => entrant.seed),
    drawSize(entrants.length),
  );
  if (!check.ok) return failed(`Fix the seeds first. ${check.error}`);

  // Lots need no cryptographic randomness.
  saveGeneratedDraw(database, {
    tournamentId,
    category,
    lines: generateDraw(entrants, Math.random),
  });
  return saved();
}

export async function changeDrawStatus(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin();
  const drawId = String(formData.get("drawId") ?? "");
  const to = String(formData.get("to") ?? "");
  if (to !== "published" && to !== "draft") throw new Error(`Unknown draw status "${to}".`);

  const database = getDb();
  const draw = database.select().from(draws).where(eq(draws.id, drawId)).get();
  if (!draw) throw new Error(`Draw ${drawId} does not exist.`);

  if (to === "published") {
    const current = getDrawWithSlots(database, draw.tournamentId, draw.category);
    const entrants = eligibleRows(listTournamentEntries(draw.tournamentId), draw.category).map(
      toDrawEntrant,
    );
    if (current && hasDrawChanges(drawChanges(current.slots, entrants))) {
      return failed("Entries or seeds changed since this draw was made. Generate it again first.");
    }
    setDrawStatus(database, drawId, "draft", "published");
  } else {
    setDrawStatus(database, drawId, "published", "draft");
  }
  return saved();
}
