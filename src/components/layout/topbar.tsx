"use client";

import { signOut } from "next-auth/react";
import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ui/theme-toggle";

interface TopbarProps {
  user?: {
    name?: string | null;
    email?: string | null;
  };
}

export function Topbar({ user }: TopbarProps) {
  const [pending, startTransition] = useTransition();

  return (
    <header className="flex items-center justify-between border-b border-[var(--border)] bg-[var(--card)] px-6 py-4 shadow-sm">
      <div>
        <p className="text-sm text-[var(--muted-foreground)]">Welcome back</p>
        <p className="text-lg font-semibold text-[var(--foreground)]">
          {user?.name ?? user?.email ?? "User"}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <ThemeToggle />
        <Button
          variant="ghost"
          onClick={() => startTransition(() => signOut({ callbackUrl: "/login" }))}
          disabled={pending}
        >
          {pending ? "Signing out..." : "Sign out"}
        </Button>
      </div>
    </header>
  );
}
