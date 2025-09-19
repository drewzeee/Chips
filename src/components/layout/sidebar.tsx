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
    <aside className="hidden w-64 flex-col border-r border-gray-200 bg-gray-50 p-6 lg:flex">
      <div className="mb-6">
        <Link href="/dashboard" className="text-xl font-semibold text-gray-900">
          Personal Finance Portal
        </Link>
      </div>
      <nav className="space-y-1">
        {links.map((link) => {
          const active = pathname === link.href || pathname.startsWith(link.href + "/");
          return (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "block rounded-md px-4 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-blue-600 text-white shadow"
                  : "text-gray-700 hover:bg-gray-200"
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
