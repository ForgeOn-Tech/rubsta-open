export const CHALLENGE_KINDS = ["serve", "accuracy", "reaction"] as const;
export type ChallengeKind = typeof CHALLENGE_KINDS[number];
export const CHALLENGES = {
  serve: { title: "Serve speed", unit: "km/h", rule: "Fastest measured serve wins. Higher is better.", help: "Enter the measured speed, from 1 to 300 km/h.", min: 1, max: 300, step: 0.1 },
  accuracy: { title: "Accuracy", unit: "hits / 10", rule: "Count target hits in 10 shots. Higher is better.", help: "Use the same target and distance for every player. Enter 0–10 hits.", min: 0, max: 10, step: 1 },
  reaction: { title: "Reaction time", unit: "ms", rule: "Fastest measured reaction wins. Lower is better.", help: "Use the same timing method for everyone. Enter 1–10,000 milliseconds.", min: 1, max: 10000, step: 1 },
} as const;
export function isChallengeKind(value: unknown): value is ChallengeKind {
  return typeof value === "string" && (CHALLENGE_KINDS as readonly string[]).includes(value);
}
export function parseChallengeScore(kind: ChallengeKind, input: string): number {
  const value = input.trim();
  const pattern = kind === "serve" ? /^\d+(\.\d)?$/ : /^\d+$/;
  const number = Number(value);
  const rules = CHALLENGES[kind];
  if (!pattern.test(value) || !Number.isFinite(number) || number < rules.min || number > rules.max) throw new Error(rules.help);
  return kind === "serve" ? Math.round(number * 10) : number;
}
export function formatChallengeScore(kind: ChallengeKind, score: number): string {
  return kind === "serve" ? `${(score / 10).toFixed(1)} km/h` : kind === "accuracy" ? `${score} / 10` : `${score} ms`;
}
export interface RankedAttempt { userId: string; name: string; score: number; createdAt: number }
export function rankChallengeAttempts(kind: ChallengeKind, attempts: readonly RankedAttempt[]) {
  const players = new Map<string, RankedAttempt & { attempts: number }>();
  for (const attempt of attempts) {
    const row = players.get(attempt.userId);
    if (!row) { players.set(attempt.userId, { ...attempt, attempts: 1 }); continue; }
    row.attempts += 1;
    const better = kind === "reaction" ? attempt.score < row.score : attempt.score > row.score;
    if (better) { row.score = attempt.score; row.createdAt = attempt.createdAt; }
  }
  const rows = [...players.values()].sort((a, b) => (kind === "reaction" ? a.score - b.score : b.score - a.score) || a.name.localeCompare(b.name) || a.userId.localeCompare(b.userId));
  let rank = 0;
  return rows.map((row, i) => { if (i === 0 || row.score !== rows[i - 1].score) rank = i + 1; return { ...row, rank }; });
}
