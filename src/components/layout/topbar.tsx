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
    <header className="sticky top-0 z-40 flex items-center justify-between border-b border-[var(--border)] bg-[color:color-mix(in_srgb,var(--background)_65%,transparent)] px-8 py-4 backdrop-blur-2xl">
      <div>
        <p className="text-xs uppercase tracking-[0.3em] text-[var(--muted-foreground)]">Welcome back</p>
        <p className="text-xl font-semibold text-[var(--foreground)]">
          {user?.name ?? user?.email ?? "User"}
        </p>
      </div>
      <div className="flex items-center gap-3">
        <DashboardDatePicker />
        <ThemeToggle />
        <Button
          variant="secondary"
          size="sm"
          className="px-4"
          onClick={() => startTransition(() => signOut({ callbackUrl: "/login" }))}
          disabled={pending}
        >
          {pending ? "Signing out" : "Sign out"}
        </Button>
      </div>
    </header>
  );
}
