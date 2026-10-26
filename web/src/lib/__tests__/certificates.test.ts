import { describe, expect, it } from "vitest";

import type { ScoringMatchRow } from "@/db/matches";
import type { Category, Match } from "@/db/schema";
import {
  certificateFileName,
  certificateLabel,
  certificatePath,
  certificateText,
  earnedCertificates,
  titleCaseName,
  type CertificateDetails,
} from "@/lib/certificates";

const AT = 1_700_000_000_000;

function row(id: string, category: Category, overrides: Partial<Match>): ScoringMatchRow {
  const match: Match = {
    id,
    drawId: category,
    matchNumber: 1,
    roundIndex: 0,
    roundName: "Semi-finals",
    groupNumber: null,
    topSlot: { kind: "entry", entryId: "mine" },
    bottomSlot: { kind: "entry", entryId: "theirs" },
    events: [{ type: "point", side: "top" }],
    decidingSet: "set",
    manualScore: false,
    format: null,
    firstServer: "top",
    status: "completed",
    winnerEntryId: "mine",
    court: 1,
    startedAt: AT,
    completedAt: AT,
    version: 1,
    createdAt: AT,
    updatedAt: AT,
    ...overrides,
  };
  return { match, category, top: null, bottom: null };
}

const MINE = new Set(["mine", "my-doubles"]);

describe("earnedCertificates", () => {
  it("gives participation for a played match and a winner's certificate for a won final", () => {
    const rows = [
      row("semi", "OS", {}),
      row("final", "OS", { roundIndex: 1, topSlot: { kind: "entry", entryId: "mine" }, winnerEntryId: "mine" }),
    ];

    expect(earnedCertificates(rows, MINE)).toEqual([
      { entryId: "mine", category: "OS", kind: "participation" },
      { entryId: "mine", category: "OS", kind: "winner" },
    ]);
  });

  it("gives participation after a loss, and orders events as the app does", () => {
    const rows = [
      row("doubles", "OD", { topSlot: { kind: "entry", entryId: "my-doubles" }, winnerEntryId: "theirs" }),
      row("singles", "OS", { winnerEntryId: "theirs" }),
    ];

    // Each event here has one match, so that match is also its final.
    expect(earnedCertificates(rows, MINE).map((item) => [item.category, item.kind])).toEqual([
      ["OS", "participation"],
      ["OS", "runner-up"],
      ["OD", "participation"],
      ["OD", "runner-up"],
    ]);
  });

  it("gives nothing for matches not yet played, walkovers, or other players' results", () => {
    const rows = [
      row("scheduled", "OS", { status: "scheduled", winnerEntryId: null, firstServer: null, startedAt: null }),
      row("walkover", "W30", { firstServer: null, events: [], winnerEntryId: "theirs" }),
      row("others", "OD", { topSlot: { kind: "entry", entryId: "a" }, winnerEntryId: "a" }),
    ];

    expect(earnedCertificates(rows, MINE)).toEqual([]);
  });

  it("gives the beaten finalist a runner-up certificate, also after a retirement", () => {
    const rows = [
      row("semi", "OS", {}),
      // A retirement completes the match with the points played so far.
      row("final", "OS", { roundIndex: 1, topSlot: { kind: "entry", entryId: "a" }, bottomSlot: { kind: "entry", entryId: "mine" }, winnerEntryId: "a" }),
    ];

    expect(earnedCertificates(rows, MINE)).toEqual([
      { entryId: "mine", category: "OS", kind: "participation" },
      { entryId: "mine", category: "OS", kind: "runner-up" },
    ]);
  });

  it("gives no runner-up certificate to a player knocked out before the final", () => {
    const rows = [
      row("semi", "OS", { winnerEntryId: "theirs" }),
      row("final", "OS", { roundIndex: 1, topSlot: { kind: "entry", entryId: "theirs" }, bottomSlot: { kind: "entry", entryId: "b" }, winnerEntryId: "theirs" }),
    ];

    expect(earnedCertificates(rows, MINE).map((item) => item.kind)).toEqual(["participation"]);
  });

  it("gives no winner's certificate before the final is complete", () => {
    const rows = [
      row("semi", "OS", {}),
      row("final", "OS", { roundIndex: 1, status: "in_progress", winnerEntryId: null }),
    ];

    expect(earnedCertificates(rows, MINE).map((item) => item.kind)).toEqual(["participation"]);
  });
});

describe("certificate names", () => {
  it("labels, links and names the file", () => {
    const certificate = { entryId: "entry-1", category: "OS" as const, kind: "winner" as const };

    expect(certificateLabel(certificate)).toBe("Open singles · Winner's certificate");
    expect(certificatePath(certificate)).toBe("/home/certificates/entry-1/winner");
    expect(certificateFileName("Rubsta Open 2026", "OS", "winner")).toBe("rubsta-open-2026-open-singles-winner.pdf");
    expect(certificateLabel({ ...certificate, kind: "runner-up" })).toBe("Open singles · Runner-up certificate");
    expect(certificateFileName("Rubsta Open 2026", "OD", "runner-up")).toBe("rubsta-open-2026-open-doubles-runner-up.pdf");
  });
});

describe("titleCaseName", () => {
  it("capitalises words typed all in lower or upper case", () => {
    expect(titleCaseName("asha rao")).toBe("Asha Rao");
    expect(titleCaseName("VIKRAM SEN")).toBe("Vikram Sen");
    expect(titleCaseName("Kiran desai")).toBe("Kiran Desai");
  });

  it("keeps mixed-case words, initials and punctuation", () => {
    expect(titleCaseName("Ian McDonald")).toBe("Ian McDonald");
    expect(titleCaseName("R Raghunandan")).toBe("R Raghunandan");
    expect(titleCaseName("o'brien-SMITH")).toBe("O'Brien-Smith");
    expect(titleCaseName("")).toBe("");
  });
});

describe("certificateText", () => {
  const details: CertificateDetails = {
    kind: "participation",
    playerName: "Gaurav Pillai",
    partnerName: null,
    category: "OS",
    tournamentName: "Rubsta Open 2026",
    dates: "25–27 Sept 2026",
    venue: "Deccan Gymkhana, Pune",
    playerId: "FL-2026-0117",
  };

  it("writes a participation certificate", () => {
    expect(certificateText(details)).toEqual({
      kind: "participation",
      title: "Certificate of participation",
      lead: "This certifies that",
      name: "Gaurav Pillai",
      statement: "took part in the Open singles at Rubsta Open 2026",
      detail: "25–27 Sept 2026 · Deccan Gymkhana, Pune",
      seal: "Participant",
      number: "FL-2026-0117-OS-P",
      footer: "Powered by ForgeLabs",
    });
  });

  it("names the doubles partner on a winner's certificate", () => {
    expect(certificateText({ ...details, kind: "winner", category: "OD", partnerName: "Meera Iyer" })).toMatchObject({
      title: "Winner's certificate",
      statement: "won the Open doubles with Meera Iyer at Rubsta Open 2026",
      number: "FL-2026-0117-OD-W",
    });
  });

  it("writes a runner-up certificate", () => {
    expect(certificateText({ ...details, kind: "runner-up" })).toMatchObject({
      title: "Runner-up certificate",
      statement: "finished runner-up in the Open singles at Rubsta Open 2026",
      seal: "Runner-up",
      number: "FL-2026-0117-OS-R",
    });
  });

  it("title-cases the player and partner names", () => {
    expect(certificateText({ ...details, playerName: "asha rao", category: "OD", partnerName: "MEERA IYER" })).toMatchObject({
      name: "Asha Rao",
      statement: "took part in the Open doubles with Meera Iyer at Rubsta Open 2026",
    });
  });

  it("leaves out what the tournament and player do not have", () => {
    expect(certificateText({ ...details, dates: null, venue: null, playerId: null })).toMatchObject({
      detail: null,
      number: null,
    });
  });
});
