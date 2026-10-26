import type { ScoringMatchRow } from "@/db/matches";
import { CATEGORIES, CATEGORY_LABELS, CERTIFICATE_KINDS, type Category, type CertificateKind } from "@/db/schema";
import { scoreRecordOf } from "@/lib/score-record";

export { CERTIFICATE_KINDS, type CertificateKind };

export const CERTIFICATE_TITLES: Record<CertificateKind, string> = {
  participation: "Certificate of participation",
  "runner-up": "Runner-up certificate",
  winner: "Winner's certificate",
};

/** The word on the certificate's seal. */
const SEAL_WORDS: Record<CertificateKind, string> = {
  participation: "Participant",
  "runner-up": "Runner-up",
  winner: "Winner",
};

/** The last part of a certificate number: FL-2026-0117-OS-W. */
const NUMBER_SUFFIXES: Record<CertificateKind, string> = {
  participation: "P",
  "runner-up": "R",
  winner: "W",
};

export function isCertificateKind(value: string): value is CertificateKind {
  return (CERTIFICATE_KINDS as readonly string[]).includes(value);
}

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

/** What a certificate prints. */
export interface CertificateText {
  kind: CertificateKind;
  title: string;
  lead: string;
  name: string;
  statement: string;
  detail: string | null;
  seal: string;
  /** e.g. "FL-2026-0117-OS-W": unique per player, event and kind. Null without a player ID. */
  number: string | null;
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
 * Certificates for `entryIds`: participation for each entry that played a match with
 * points, and winner and runner-up for each completed final one of them played in. A
 * final that ended in a retirement still has both; a runner-up who never played a
 * scored match, such as one beaten by walkover in a two-player event, gets none.
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

  const finalists: Certificate[] = CATEGORIES.flatMap((category) => {
    const inEvent = rows.filter((row) => row.category === category);
    if (inEvent.length === 0) return [];
    const lastRound = Math.max(...inEvent.map((row) => row.match.roundIndex));
    const final = inEvent.find((row) => row.match.roundIndex === lastRound);
    if (final?.match.status !== "completed" || final.match.winnerEntryId === null) return [];
    const winner = final.match.winnerEntryId;
    // A runner-up must have played a scored match, so a walkover alone earns nothing.
    return entryIdsOf(final)
      .filter((entryId) => entryIds.has(entryId) && (entryId === winner || participated.has(entryId)))
      .map((entryId): Certificate => ({ entryId, category, kind: entryId === winner ? "winner" : "runner-up" }));
  });

  return [...participation, ...finalists].sort((a, b) => certificateOrder(a) - certificateOrder(b));
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

const STATEMENT_VERBS: Record<CertificateKind, string> = {
  participation: "took part in the",
  "runner-up": "finished runner-up in the",
  winner: "won the",
};

const NAME_WORD = /\p{L}+/gu;

/**
 * Capitalises each word of a name typed all in lower or upper case: "asha rao" and
 * "VIKRAM SEN" become "Asha Rao" and "Vikram Sen". Mixed-case words such as
 * "McDonald" stay as typed.
 */
export function titleCaseName(name: string): string {
  return name.replace(NAME_WORD, (word) =>
    word === word.toLowerCase() || word === word.toUpperCase()
      ? word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
      : word,
  );
}

export function certificateText(details: CertificateDetails): CertificateText {
  // Event names keep their capitals: "U-15 juniors", "Women's 30+".
  const event = CATEGORY_LABELS[details.category];
  const withPartner = details.partnerName === null ? "" : ` with ${titleCaseName(details.partnerName)}`;
  return {
    kind: details.kind,
    title: CERTIFICATE_TITLES[details.kind],
    lead: "This certifies that",
    name: titleCaseName(details.playerName),
    statement: `${STATEMENT_VERBS[details.kind]} ${event}${withPartner} at ${details.tournamentName}`,
    detail: [details.dates, details.venue].filter((part) => part !== null).join(" · ") || null,
    seal: SEAL_WORDS[details.kind],
    number: details.playerId === null
      ? null
      : `${details.playerId}-${details.category}-${NUMBER_SUFFIXES[details.kind]}`,
    footer: "Powered by ForgeLabs",
  };
}
