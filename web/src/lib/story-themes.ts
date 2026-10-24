/** The colour themes a player can pick for their Instagram story card. */
export const STORY_THEMES = ["court", "clay", "hard", "night"] as const;
export type StoryTheme = (typeof STORY_THEMES)[number];

export interface StoryPalette {
  name: string;
  background: string;
  /** Text on the background. */
  ink: string;
  /** The tag block and photo frame. */
  accent: string;
  /** One colour per standout-number tile, in order. */
  tiles: readonly [string, string, string];
  /** Text on the accent and the tiles. */
  tileInk: string;
  /** The faint court lines behind everything. */
  lines: string;
}

export const STORY_PALETTES: Record<StoryTheme, StoryPalette> = {
  court: {
    name: "Grass",
    background: "#294f35",
    ink: "#f3f1df",
    accent: "#dfeb8c",
    tiles: ["#dfeb8c", "#f4a259", "#8fd3e8"],
    tileInk: "#1d2b21",
    lines: "rgba(243, 241, 223, 0.16)",
  },
  clay: {
    name: "Clay",
    background: "#b5502e",
    ink: "#fff4e6",
    accent: "#ffd166",
    tiles: ["#ffd166", "#fff4e6", "#7fd1c3"],
    tileInk: "#3a1a0e",
    lines: "rgba(255, 244, 230, 0.2)",
  },
  hard: {
    name: "Hard court",
    background: "#1d4e89",
    ink: "#f1f6ff",
    accent: "#f9c74f",
    tiles: ["#f9c74f", "#90e0ef", "#f28482"],
    tileInk: "#0d2340",
    lines: "rgba(241, 246, 255, 0.18)",
  },
  night: {
    name: "Night match",
    background: "#1b1340",
    ink: "#f5f0ff",
    accent: "#ff5d8f",
    tiles: ["#ff5d8f", "#4cd6e8", "#ffd23f"],
    tileInk: "#1b1340",
    lines: "rgba(245, 240, 255, 0.14)",
  },
};

export function isStoryTheme(value: string): value is StoryTheme {
  return (STORY_THEMES as readonly string[]).includes(value);
}
