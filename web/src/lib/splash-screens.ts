import screens from "./splash-screens.json";

/** An iPhone screen in CSS pixels, portrait, with its device pixel ratio. */
export type SplashScreen = { width: number; height: number; ratio: number };
/** The shape Next.js metadata takes for appleWebApp.startupImage. */
export type StartupImage = { url: string; media: string };

/** scripts/build-splash-screens.cjs renders one image per screen into public/. */
export const SPLASH_SCREENS: readonly SplashScreen[] = screens;
export const SPLASH_DIRECTORY = "/splash";

export function splashImagePath(screen: SplashScreen): string {
  return `${SPLASH_DIRECTORY}/${screen.width * screen.ratio}x${screen.height * screen.ratio}.png`;
}

/** iOS shows a launch image only when its media query matches the screen exactly. */
export function splashStartupImages(screens: readonly SplashScreen[]): StartupImage[] {
  return screens.map((screen) => ({
    url: splashImagePath(screen),
    media:
      `(device-width: ${screen.width}px) and (device-height: ${screen.height}px)` +
      ` and (-webkit-device-pixel-ratio: ${screen.ratio}) and (orientation: portrait)`,
  }));
}
