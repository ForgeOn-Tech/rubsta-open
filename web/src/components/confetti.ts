const PARTICLE_MS = 900;
const SPREAD_PX = 90;
const RISE_PX = 70;
const FALL_PX = 60;

/** Confetti pieces in the Fan Zone's colours, for a burst without emoji. */
export const CONFETTI_PIECES = ["●", "■", "▲", "◆"] as const;
export const CONFETTI_COLOURS = ["#c8e66b", "#f3f0e8", "#f2b134", "#7fc8a9"] as const;

/**
 * Throws `count` pieces up and out from the middle of `origin`, then lets them fall and
 * fade. The pieces are decoration only, so screen readers skip them, and nothing runs for
 * a viewer who asked for reduced motion.
 */
export function burstFrom(origin: HTMLElement, pieces: readonly string[], count: number): void {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const box = origin.getBoundingClientRect();
  const x = box.left + box.width / 2;
  const y = box.top + box.height / 2;

  for (let index = 0; index < count; index += 1) {
    const piece = document.createElement("span");
    piece.textContent = pieces[index % pieces.length];
    piece.setAttribute("aria-hidden", "true");
    piece.style.cssText = `position:fixed;left:${x}px;top:${y}px;pointer-events:none;z-index:50;font-size:${14 + Math.random() * 10}px;color:${CONFETTI_COLOURS[index % CONFETTI_COLOURS.length]}`;
    document.body.appendChild(piece);

    const dx = (Math.random() - 0.5) * 2 * SPREAD_PX;
    const peak = -RISE_PX - Math.random() * RISE_PX;
    const spin = (Math.random() - 0.5) * 720;
    piece
      .animate(
        [
          { transform: "translate(-50%, -50%) scale(0.6)", opacity: 1 },
          { transform: `translate(calc(-50% + ${dx * 0.7}px), calc(-50% + ${peak}px)) rotate(${spin / 2}deg)`, opacity: 1, offset: 0.45 },
          { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${peak + FALL_PX}px)) rotate(${spin}deg)`, opacity: 0 },
        ],
        { duration: PARTICLE_MS + Math.random() * 300, easing: "cubic-bezier(0.2, 0.7, 0.4, 1)" },
      )
      .finished.finally(() => piece.remove());
  }
}
