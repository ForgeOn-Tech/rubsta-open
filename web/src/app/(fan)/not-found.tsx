import Link from "next/link";

import { FAN_LEADERBOARD_PATH, FAN_LIVE_PATH } from "@/lib/fan-chat";

const ELSEWHERE = [
  { href: FAN_LIVE_PATH, label: "All courts" },
  { href: FAN_LEADERBOARD_PATH, label: "Prediction leaderboard" },
];

/** A court that does not exist, inside the Fan Zone chrome. */
export default function FanNotFound() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-[10px] font-medium uppercase tracking-[2px] text-club-lime">Fan zone</p>
        <h1 className="mt-2 font-serif text-[46px] font-normal leading-none tracking-[-1px]">
          No such court
        </h1>
        <p className="mt-3 text-[13px] text-club-mist/70">
          Courts are numbered by the organisers. Pick one that is playing.
        </p>
      </div>

      <ul className="border-t border-club-mist/20">
        {ELSEWHERE.map((item) => (
          <li key={item.href} className="border-b border-club-mist/20">
            <Link
              href={item.href}
              className="flex items-center justify-between gap-4 py-4 hover:text-club-lime sm:px-2"
            >
              <span className="font-serif text-[26px] leading-tight">{item.label}</span>
              <span aria-hidden="true">→</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
