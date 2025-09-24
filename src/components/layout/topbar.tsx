"use client";

import { signOut } from "next-auth/react";
import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { DashboardDatePicker } from "@/components/layout/dashboard-date-picker";

interface TopbarProps {
  user?: {
    name?: string | null;
    email?: string | null;
  };
}

export function Topbar({ user }: TopbarProps) {
  const [pending, startTransition] = useTransition();

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between border-b border-[var(--border)] bg-[color:color-mix(in_srgb,var(--background)_65%,transparent)] px-4 py-4 backdrop-blur-2xl pl-16 lg:px-8 lg:pl-8">
      <div className="min-w-0 flex-1">
        <p className="text-xs uppercase tracking-[0.3em] text-[var(--muted-foreground)]">Welcome back</p>
        <p className="truncate text-xl font-semibold text-[var(--foreground)]">
          {user?.name ?? user?.email ?? "User"}
        </p>
      </div>
      <div className="flex items-center gap-2 lg:gap-3">
        <div className="hidden sm:block">
          <DashboardDatePicker />
        </div>
        <ThemeToggle />
        <Button
          variant="secondary"
          size="sm"
          className="px-2 text-xs lg:px-4 lg:text-sm"
          onClick={() => startTransition(() => signOut({ callbackUrl: "/login" }))}
          disabled={pending}
        >
          {pending ? "..." : "Sign out"}
        </Button>
      </div>
    </header>
  );
}
