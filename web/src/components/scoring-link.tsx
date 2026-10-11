"use client";
import Link from "next/link";
import type { ComponentProps } from "react";

type Props = Omit<ComponentProps<typeof Link>, "href" | "onNavigate"> & { href: string };

/** Offline scoring pages are full HTML documents kept by the service worker. */
export function ScoringLink({ href, ...props }: Props) {
  return <Link {...props} href={href} onNavigate={event => {
    if (!navigator.onLine && (href === "/score" || href.startsWith("/score/"))) {
      event.preventDefault();
      window.location.assign(href);
    }
  }} />;
}
