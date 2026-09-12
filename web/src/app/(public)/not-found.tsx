import Link from "next/link";

import { FAN_LIVE_PATH } from "@/lib/fan-chat";
import {
  PLAYER_DRAWS_PATH,
  PLAYER_ORDER_OF_PLAY_PATH,
  PUBLIC_RESULTS_PATH,
} from "@/lib/player-matches";

const ELSEWHERE = [
  { href: PLAYER_DRAWS_PATH, label: "Draws" },
  { href: PUBLIC_RESULTS_PATH, label: "Results" },
  { href: PLAYER_ORDER_OF_PLAY_PATH, label: "Order of play" },
  { href: FAN_LIVE_PATH, label: "Live courts" },
];

/** A draw, match or day that does not exist, inside the tournament chrome. */
export default function PublicNotFound() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-[10px] font-medium uppercase tracking-[2px] text-club-muted">Rubsta Open</p>
        <h1 className="mt-2 font-serif text-[46px] font-normal leading-none tracking-[-1px]">
          Nothing here
        </h1>
        <p className="mt-3 text-[13px] text-club-muted">
          That page has moved, or the event has not been published yet.
        </p>
      </div>

      <ul className="border-t border-club-line">
        {ELSEWHERE.map((item) => (
          <li key={item.href} className="border-b border-club-line">
            <Link
              href={item.href}
              className="flex items-center justify-between gap-4 py-4 hover:bg-club-paper sm:px-2"
            >
              <span className="font-serif text-[26px] leading-tight">{item.label}</span>
              <span aria-hidden="true" className="text-club-deep">
                →
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
