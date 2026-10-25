"use client";

import { useEffect, useState, useSyncExternalStore } from "react";

import { type BeforeInstallPromptEvent, installMode, isIos } from "@/lib/install-app";

const STANDALONE_QUERY = "(display-mode: standalone)";
const BUTTON_CLASS = "cursor-pointer whitespace-nowrap text-[11px] font-medium uppercase tracking-[1px]";

function subscribeToNothing(): () => void {
  return () => {};
}

function subscribeToDisplayMode(onChange: () => void): () => void {
  const query = window.matchMedia(STANDALONE_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

function runsStandalone(): boolean {
  // Safari on iOS reports an installed app through navigator.standalone only.
  const iosStandalone = (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return iosStandalone || window.matchMedia(STANDALONE_QUERY).matches;
}

function runsOnIos(): boolean {
  return isIos(navigator.userAgent, navigator.maxTouchPoints);
}

/**
 * Offers to add Rubsta Open to the home screen. Chrome and Edge open their own
 * install dialog; iPhone and iPad get the Share-menu steps, because iOS has no
 * dialog. Nothing shows once the app is installed or where neither works.
 */
export function InstallAppButton() {
  // The server cannot tell, so it renders nothing until the browser has been checked.
  const standalone = useSyncExternalStore(subscribeToDisplayMode, runsStandalone, () => true);
  const ios = useSyncExternalStore(subscribeToNothing, runsOnIos, () => false);
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [stepsOpen, setStepsOpen] = useState(false);

  useEffect(() => {
    function keepInstallEvent(event: Event) {
      // Stops Chrome's own mini-bar, so the header button opens the dialog instead.
      event.preventDefault();
      setInstallEvent(event as BeforeInstallPromptEvent);
    }
    function markInstalled() {
      setInstallEvent(null);
      setInstalled(true);
    }
    window.addEventListener("beforeinstallprompt", keepInstallEvent);
    window.addEventListener("appinstalled", markInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", keepInstallEvent);
      window.removeEventListener("appinstalled", markInstalled);
    };
  }, []);

  const mode = installMode({ standalone: standalone || installed, canPrompt: installEvent !== null, ios });
  if (mode === "installed" || mode === "unavailable") return null;

  async function install() {
    if (installEvent === null) return;
    await installEvent.prompt();
    const { outcome } = await installEvent.userChoice;
    // Chrome allows one prompt per event; a new event arrives if the player declined.
    setInstallEvent(null);
    if (outcome === "accepted") setInstalled(true);
  }

  if (mode === "prompt") {
    return <button type="button" className={BUTTON_CLASS} onClick={install}>Install app</button>;
  }
  return <div className="relative">
    <button type="button" className={BUTTON_CLASS} aria-expanded={stepsOpen}
      aria-controls="install-app-steps" onClick={() => setStepsOpen((open) => !open)}>
      Install app
    </button>
    {stepsOpen ? <div id="install-app-steps" role="region" aria-label="Install Rubsta Open"
      className="absolute right-0 top-full z-20 mt-3 w-64 bg-club-mist p-4 text-[13px] leading-snug text-club-ink shadow-lg">
      <ol className="list-decimal space-y-1.5 pl-4">
        <li>Tap the <strong>Share</strong> button in your browser.</li>
        <li>Tap <strong>Add to Home Screen</strong>, then <strong>Add</strong>.</li>
      </ol>
      <p className="mt-2 text-club-muted">Rubsta Open then opens from your home screen like an app.</p>
    </div> : null}
  </div>;
}
