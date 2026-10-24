/** A match on the umpire's list, as plain text the browser can search. */
export interface MatchCardView {
  id: string;
  /** e.g. "M23 · Open singles · Quarter-finals" */
  heading: string;
  court: string;
  top: string;
  bottom: string;
  summary: string | null;
  place: string | null;
  /** False for a match still waiting on earlier results, which cannot be opened yet. */
  linked: boolean;
}

/** One heading on the umpire's list and its matches. */
export interface MatchGroupView {
  id: string;
  title: string;
  cards: MatchCardView[];
}

const WORD_BREAK = /[\s·]+/;

function wordsOf(text: string): string[] {
  return text.toLowerCase().split(WORD_BREAK).filter((word) => word !== "");
}

/**
 * True when every word of the search starts a word in the match's number, event, round,
 * court or players, so "court 3" finds Court 3 and not M13. An empty search keeps every match.
 */
export function cardMatchesSearch(card: MatchCardView, search: string): boolean {
  const words = wordsOf([card.heading, card.court, card.top, card.bottom].join(" "));
  return wordsOf(search).every((part) => words.some((word) => word.startsWith(part)));
}

/** The groups with only the matches that fit the search, leaving out groups left empty. */
export function filterMatchGroups(groups: readonly MatchGroupView[], search: string): MatchGroupView[] {
  return groups
    .map((group) => ({ ...group, cards: group.cards.filter((card) => cardMatchesSearch(card, search)) }))
    .filter((group) => group.cards.length > 0);
}
