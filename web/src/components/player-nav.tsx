"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  ["/home", "Home"], ["/register", "Registration"], ["/profile", "Profile"],
  ["/draws", "Draws"], ["/order-of-play", "Order of play"], ["/results", "Results"],
  ["/live", "Live"], ["/live/leaderboard", "Leaderboard"], ["/challenges", "Challenges"],
] as const;

export function PlayerNav({ signedIn }: { signedIn: boolean }) {
  const pathname = usePathname();
  return <nav aria-label="Tournament" className="overflow-x-auto">
    <div className="flex w-max min-w-full gap-5 text-[11px] font-medium uppercase tracking-[1px]">
      {tabs.filter(([href]) => signedIn || !["/home", "/register", "/profile"].includes(href)).map(([href, label]) => {
        const active = (pathname === href || pathname.startsWith(href + "/"))
          && !(href === "/live" && pathname.startsWith("/live/leaderboard"));
        return <Link key={href} href={href} aria-current={active ? "page" : undefined}
          className="shrink-0 whitespace-nowrap border-b-2 py-3"
          style={{ color: "inherit", borderColor: active ? "currentColor" : "transparent" }}>{label}</Link>;
      })}
    </div>
  </nav>;
}
