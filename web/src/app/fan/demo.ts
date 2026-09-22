import type { FanDraw } from "@/db/fan";

/** Fictional entrants, isolated from the tournament database. */
export const DEMO_DRAWS: FanDraw[] = [
  sampleDraw("MS", ["Arjun Mehta", "Rohan Shah", "Kabir Sethi", "Dev Malhotra", "Ishaan Rao", "Neel Kapoor", "Vihaan Desai", "Aarav Menon"]),
  sampleDraw("WS", ["Ananya Rao", "Tara Shah", "Riya Mehta", "Mira Sethi", "Sara Kapoor", "Diya Nair", "Avni Desai", "Isha Menon"]),
  sampleDraw("MD", ["Arjun Mehta / Rohan Shah", "Kabir Sethi / Dev Malhotra", "Ishaan Rao / Neel Kapoor", "Vihaan Desai / Aarav Menon"]),
  sampleDraw("WD", ["Ananya Rao / Tara Shah", "Riya Mehta / Mira Sethi", "Sara Kapoor / Diya Nair", "Avni Desai / Isha Menon"]),
];

function sampleDraw(category: FanDraw["category"], names: string[]): FanDraw {
  return {
    id: `demo-${category}`, category, size: names.length,
    slots: names.map((label, index) => ({
      position: index + 1, entryId: `demo-${category}-${index + 1}`,
      seed: index === 0 ? 1 : index === names.length - 1 ? 2 : null,
      label,
    })),
  };
}
