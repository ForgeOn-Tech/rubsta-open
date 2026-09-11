"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { ADMIN_NAV, isActiveNavItem } from "@/lib/admin-nav";

export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Admin" className="overflow-x-auto md:overflow-visible">
      <ul className="flex md:flex-col md:py-3">
        {ADMIN_NAV.map((item) => {
          if (!item.href) {
            return (
              <li key={item.label} className="hidden md:block">
                <span
                  aria-disabled="true"
                  className="flex h-[34px] items-center justify-between gap-3 whitespace-nowrap px-[18px] text-[13px] text-dim"
                >
                  {item.label}
                  <span className="mono text-[9px] uppercase tracking-[0.08em]">Soon</span>
                </span>
              </li>
            );
          }
          const active = isActiveNavItem(pathname, item.href);
          return (
            <li key={item.label}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`flex h-[34px] items-center whitespace-nowrap px-[18px] text-[13px] ${
                  active
                    ? "border-b-2 border-accent bg-surface-2 font-semibold md:border-b-0 md:border-l-2 md:pl-4"
                    : ""
                }`}
                // Inline colour: the global `a` rule is unlayered and outranks utilities.
                style={{ color: active ? "var(--color-accent)" : "var(--color-muted)" }}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
