import type { Category } from "@/db/schema";

export const EARLY_BIRD_END = "2026-10-01T00:00:00+05:30";

export const REGISTRATION_OPTIONS = [
  { id: "OS", categories: ["OS"] },
  { id: "W30", categories: ["W30"] },
  { id: "U15", categories: ["U15"] },
  { id: "OD", categories: ["OD"] },
  { id: "S40", categories: ["S40"] },
  { id: "OS_OD", categories: ["OS", "OD"] },
  { id: "S40_OD", categories: ["S40", "OD"] },
  { id: "W30_OD", categories: ["W30", "OD"] },
] as const satisfies readonly { id: string; categories: readonly Category[] }[];

export type RegistrationOptionId = (typeof REGISTRATION_OPTIONS)[number]["id"];

export function registrationOption(id: string) {
  return REGISTRATION_OPTIONS.find(option => option.id === id) ?? null;
}

export function isEarlyBird(now = new Date()): boolean {
  return now.getTime() < new Date(EARLY_BIRD_END).getTime();
}

/** Fees are in paise. A single event gets ₹200 off; each approved two-event option gets ₹500 off. */
export function registrationPrice(fees: Record<Category, number>, categories: readonly Category[], now = new Date()): number {
  const standard = categories.reduce((total, category) => total + fees[category], 0);
  if (!isEarlyBird(now)) return standard;
  return standard - (categories.length === 2 ? 50000 : 20000);
}

export function registrationOptionLabel(id: RegistrationOptionId): string {
  return ({ OS: "Open singles", W30: "Women's 30+", U15: "U-15 juniors", OD: "Open doubles", S40: "40+ singles", OS_OD: "Open singles + Open doubles", S40_OD: "40+ singles + Open doubles", W30_OD: "Women's 30+ + Open doubles" })[id];
}
