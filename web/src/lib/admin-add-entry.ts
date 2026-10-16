import { GENDERS, type Category, type Gender } from "@/db/schema";
import { ageFromDob } from "@/lib/age";
import { isDoubles, isValidCategory } from "@/lib/entries";
import { isEmailAddress, normaliseEmail } from "@/lib/partners";

export const ADMIN_NEW_ENTRY_PATH = "/admin/entries/new";

/** An admin adds an entry already paid at the desk, or confirmed with the fee still due. */
export const ADDED_ENTRY_STATUSES = ["paid", "confirmed"] as const;
export type AddedEntryStatus = (typeof ADDED_ENTRY_STATUSES)[number];

/** One player's details as typed into the form. */
export interface RawPerson {
  fullName: string;
  email: string;
  dateOfBirth: string;
  gender: string;
  mobile: string;
  club: string;
}

export interface RawAdminEntry {
  category: string;
  status: string;
  player: RawPerson;
  /** Read only for doubles. */
  partner: RawPerson;
}

export interface Person {
  fullName: string;
  /** Lower case. */
  email: string;
  dateOfBirth: string;
  gender: Gender;
  mobile: string;
  club: string | null;
}

export interface AdminEntryInput {
  category: Category;
  status: AddedEntryStatus;
  player: Person;
  /** Null for singles. */
  partner: Person | null;
}

export type AdminEntryValidation =
  | { ok: true; input: AdminEntryInput }
  | { ok: false; error: string };

type PersonCheck = { ok: true; person: Person } | { ok: false; error: string };

function checkPerson(raw: RawPerson, who: string, now: Date): PersonCheck {
  const fullName = raw.fullName.trim();
  const mobile = raw.mobile.trim();
  const gender = GENDERS.find((value) => value === raw.gender);
  if (!fullName) return { ok: false, error: `Enter the ${who}'s full name.` };
  if (!isEmailAddress(raw.email.trim())) return { ok: false, error: `Enter a valid email for the ${who}.` };
  if (ageFromDob(raw.dateOfBirth.trim(), now) === null) {
    return { ok: false, error: `Enter a valid date of birth for the ${who}.` };
  }
  if (gender === undefined) return { ok: false, error: `Choose the ${who}'s gender.` };
  if (!mobile) return { ok: false, error: `Enter the ${who}'s mobile number.` };
  return {
    ok: true,
    person: {
      fullName,
      email: normaliseEmail(raw.email),
      dateOfBirth: raw.dateOfBirth.trim(),
      gender,
      mobile,
      club: raw.club.trim() || null,
    },
  };
}

/**
 * Rules for an entry an admin adds by hand. Unlike a player's own entry, it is allowed after
 * entries close, so walk-ins can still be added on the day.
 */
export function validateAdminEntry(raw: RawAdminEntry, now: Date): AdminEntryValidation {
  if (!isValidCategory(raw.category)) return { ok: false, error: "Choose an event." };
  const status = ADDED_ENTRY_STATUSES.find((value) => value === raw.status);
  if (status === undefined) return { ok: false, error: "Choose whether the fee is paid." };

  const player = checkPerson(raw.player, "player", now);
  if (!player.ok) return player;
  if (!isDoubles(raw.category)) {
    return { ok: true, input: { category: raw.category, status, player: player.person, partner: null } };
  }

  const partner = checkPerson(raw.partner, "partner", now);
  if (!partner.ok) return partner;
  if (partner.person.email === player.person.email) {
    return { ok: false, error: "The player and partner need different emails." };
  }
  return { ok: true, input: { category: raw.category, status, player: player.person, partner: partner.person } };
}
