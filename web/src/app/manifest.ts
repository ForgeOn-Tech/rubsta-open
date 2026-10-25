import type { MetadataRoute } from "next";

/** Matches --color-club-deep, the landing page and favicon green. */
export const APP_THEME_COLOR = "#213e2c";
/** Matches --color-club-cream, so the splash screen fades into the player home. */
const APP_BACKGROUND_COLOR = "#f4f1e8";
/** "/" is the static landing page (deploy/Caddyfile), so the installed app opens the player home. */
const APP_START_URL = "/home";

/** Lets phones add Tournament OS to the home screen and open it without browser bars. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: APP_START_URL,
    name: "Rubsta Open",
    short_name: "Rubsta Open",
    description: "Your draws, matches, live scores and certificates for Rubsta Open.",
    start_url: APP_START_URL,
    scope: "/",
    display: "standalone",
    background_color: APP_BACKGROUND_COLOR,
    theme_color: APP_THEME_COLOR,
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
