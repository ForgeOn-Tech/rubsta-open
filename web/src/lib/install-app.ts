/** How the install button can help on this browser. */
export type InstallMode = "installed" | "prompt" | "ios-steps" | "unavailable";

export type InstallContext = {
  /** The page already runs as an installed app. */
  standalone: boolean;
  /** The browser fired beforeinstallprompt, so it can show its own install dialog. */
  canPrompt: boolean;
  ios: boolean;
};

/** Chrome's install event; TypeScript's DOM types do not include it. */
export interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const IOS_DEVICE = /iPhone|iPad|iPod/;
const MAC = /Macintosh/;

/** iPadOS reports a Mac user agent; a touch screen tells them apart. */
export function isIos(userAgent: string, maxTouchPoints: number): boolean {
  return IOS_DEVICE.test(userAgent) || (MAC.test(userAgent) && maxTouchPoints > 1);
}

/** iOS has no install dialog, so iPhone and iPad users get the Share-menu steps instead. */
export function installMode(context: InstallContext): InstallMode {
  if (context.standalone) return "installed";
  if (context.canPrompt) return "prompt";
  if (context.ios) return "ios-steps";
  return "unavailable";
}
