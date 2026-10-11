export interface AdminNavItem {
  label: string;
  /** null marks a section that is not built yet. */
  href: string | null;
  /** Public static pages need a full navigation outside the app router. */
  fullPage?: boolean;
}

/** Sidebar order follows the organiser artboard (design/screens/Main.dc.html). */
export const ADMIN_NAV: readonly AdminNavItem[] = [
  { label: "Overview", href: "/admin" },
  { label: "Entries", href: "/admin/entries" },
  { label: "Draws", href: "/admin/draws" },
  { label: "Order of play", href: "/admin/order-of-play" },
  // Opens the umpire screens, outside the admin shell.
  { label: "Scoring", href: "/score" },
  { label: "Results", href: "/admin/results" },
  { label: "Players", href: "/admin/players" },
  { label: "Avatar permissions", href: "/admin/avatars" },
  { label: "Fan zone", href: "/admin/fan" },
  { label: "Certificates", href: null },
  { label: "Sponsors", href: "https://www.rubstaopen.com/#sponsors", fullPage: true },
  { label: "Settings", href: "/admin/settings" },
];

const ADMIN_ROOT = "/admin";

/** Overview matches only /admin itself; other sections also match their sub-pages. */
export function isActiveNavItem(pathname: string, href: string): boolean {
  if (href === ADMIN_ROOT) return pathname === ADMIN_ROOT;
  return pathname === href || pathname.startsWith(`${href}/`);
}
