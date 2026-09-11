export interface AdminNavItem {
  label: string;
  /** null marks a section that is not built yet. */
  href: string | null;
}

/** Sidebar order follows the organiser artboard (design/screens/Main.dc.html). */
export const ADMIN_NAV: readonly AdminNavItem[] = [
  { label: "Overview", href: "/admin" },
  { label: "Entries", href: "/admin/entries" },
  { label: "Draws", href: null },
  { label: "Order of play", href: null },
  { label: "Results", href: null },
  { label: "Players", href: "/admin/players" },
  { label: "Certificates", href: null },
  { label: "Sponsors", href: null },
  { label: "Settings", href: "/admin/settings" },
];

const ADMIN_ROOT = "/admin";

/** Overview matches only /admin itself; other sections also match their sub-pages. */
export function isActiveNavItem(pathname: string, href: string): boolean {
  if (href === ADMIN_ROOT) return pathname === ADMIN_ROOT;
  return pathname === href || pathname.startsWith(`${href}/`);
}
