"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const links = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/accounts", label: "Accounts" },
  { href: "/categories", label: "Categories" },
  { href: "/transactions", label: "Transactions" },
  { href: "/import", label: "Import" },
  { href: "/reports/monthly", label: "Reports" },
  { href: "/settings", label: "Settings" },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden w-64 flex-col gap-8 border-r border-[var(--border)] bg-[var(--secondary)] px-7 py-8 backdrop-blur-2xl lg:flex">
      <div className="flex items-center gap-3">
        <Link
          href="/dashboard"
          className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[var(--primary)] text-sm font-semibold text-[var(--primary-foreground)] shadow-[0_18px_28px_-18px_rgba(79,70,229,0.65)]"
        >
          C
        </Link>
        <div className="leading-tight">
          <p className="text-lg font-semibold tracking-tight text-[var(--foreground)]">Chips</p>
          <p className="text-xs text-[var(--muted-foreground)]">Financial hub</p>
        </div>
      </div>
      <nav className="flex flex-col gap-1.5">
        {links.map((link) => {
          const active = pathname === link.href || pathname.startsWith(link.href + "/");
          return (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "relative flex items-center rounded-xl px-4 py-2.5 text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)]",
                active
                  ? "bg-[var(--primary)] text-[var(--primary-foreground)] shadow-[0_20px_38px_-24px_rgba(79,70,229,0.75)]"
                  : "text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
              )}
            >
              {link.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
