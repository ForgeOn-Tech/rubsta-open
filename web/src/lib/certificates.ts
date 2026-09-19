import type { ScoringMatchRow } from "@/db/matches";
import { CATEGORIES, CATEGORY_LABELS, type Category } from "@/db/schema";
import { scoreRecordOf } from "@/lib/score-record";

export const CERTIFICATE_KINDS = ["participation", "winner"] as const;
export type CertificateKind = (typeof CERTIFICATE_KINDS)[number];

export const CERTIFICATE_TITLES: Record<CertificateKind, string> = {
  participation: "Certificate of participation",
  winner: "Winner's certificate",
};

export interface Certificate {
  entryId: string;
  category: Category;
  kind: CertificateKind;
}

export interface CertificateDetails {
  kind: CertificateKind;
  playerName: string;
  /** The doubles partner, or null for singles. */
  partnerName: string | null;
  category: Category;
  tournamentName: string;
  /** e.g. "25–27 Sept 2026", or null when the dates are not set. */
  dates: string | null;
  venue: string | null;
  /** e.g. "FL-2026-0117", or null when the player has no number. */
  playerId: string | null;
}

/** The lines a certificate prints, top to bottom. */
export interface CertificateText {
  title: string;
  lead: string;
  name: string;
  statement: string;
  detail: string | null;
  footer: string;
}

function entryIdsOf(row: ScoringMatchRow): string[] {
  return [row.match.topSlot, row.match.bottomSlot].flatMap((slot) =>
    slot.kind === "entry" ? [slot.entryId] : [],
  );
}

function certificateOrder(certificate: Certificate): number {
  return CATEGORIES.indexOf(certificate.category) * CERTIFICATE_KINDS.length +
    CERTIFICATE_KINDS.indexOf(certificate.kind);
}

/**
 * Certificates for `entryIds`: participation for each entry that played a
 * match with points, and winner for each event whose final one of them won.
 */
export function earnedCertificates(
  rows: readonly ScoringMatchRow[],
  entryIds: ReadonlySet<string>,
): Certificate[] {
  const participated = new Map(
    rows
      .filter((row) => row.match.status === "completed" && scoreRecordOf(row.match) !== null)
      .flatMap((row) =>
        entryIdsOf(row)
          .filter((entryId) => entryIds.has(entryId))
          .map((entryId): [string, Category] => [entryId, row.category]),
      ),
  );
  const participation: Certificate[] = [...participated].map(([entryId, category]) => ({
    entryId,
    category,
    kind: "participation",
  }));

  const winners: Certificate[] = CATEGORIES.flatMap((category) => {
    const inEvent = rows.filter((row) => row.category === category);
    if (inEvent.length === 0) return [];
    const lastRound = Math.max(...inEvent.map((row) => row.match.roundIndex));
    const final = inEvent.find((row) => row.match.roundIndex === lastRound);
    const winner = final?.match.status === "completed" ? final.match.winnerEntryId : null;
    return winner !== null && entryIds.has(winner) ? [{ entryId: winner, category, kind: "winner" as const }] : [];
  });

  return [...participation, ...winners].sort((a, b) => certificateOrder(a) - certificateOrder(b));
}

/** e.g. "Men's singles · Winner's certificate". */
export function certificateLabel(certificate: Pick<Certificate, "category" | "kind">): string {
  return `${CATEGORY_LABELS[certificate.category]} · ${CERTIFICATE_TITLES[certificate.kind]}`;
}

export function certificatePath(certificate: Pick<Certificate, "entryId" | "kind">): string {
  return `/home/certificates/${certificate.entryId}/${certificate.kind}`;
}

function slug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** e.g. "rubsta-open-2026-mens-singles-winner.pdf". */
export function certificateFileName(tournamentName: string, category: Category, kind: CertificateKind): string {
  return `${slug(`${tournamentName} ${CATEGORY_LABELS[category].replace("'", "")} ${kind}`)}.pdf`;
}

export function certificateText(details: CertificateDetails): CertificateText {
  // Event names keep their capitals: "U-15 juniors", "Women's 30+".
  const event = CATEGORY_LABELS[details.category];
  const withPartner = details.partnerName === null ? "" : ` with ${details.partnerName}`;
  const verb = details.kind === "winner" ? "won the" : "took part in the";
  return {
    title: CERTIFICATE_TITLES[details.kind],
    lead: "This certifies that",
    name: details.playerName,
    statement: `${verb} ${event}${withPartner} at ${details.tournamentName}`,
    detail: [details.dates, details.venue].filter((part) => part !== null).join(" · ") || null,
    footer: [details.playerId === null ? null : `Player ID ${details.playerId}`, "Powered by ForgeLabs"]
      .filter((part) => part !== null)
      .join(" · "),
  };
}
