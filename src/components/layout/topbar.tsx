"use client";

import { signOut } from "next-auth/react";
import { useTransition } from "react";
import { Button } from "@/components/ui/button";

interface TopbarProps {
  user?: {
    name?: string | null;
    email?: string | null;
  };
}

export function Topbar({ user }: TopbarProps) {
  const [pending, startTransition] = useTransition();

  return (
    <header className="flex items-center justify-between border-b border-gray-200 bg-white px-6 py-4 shadow-sm">
      <div>
        <p className="text-sm text-gray-500">Welcome back</p>
        <p className="text-lg font-semibold text-gray-900">
          {user?.name ?? user?.email ?? "User"}
        </p>
      </div>
      <Button
        variant="ghost"
        onClick={() => startTransition(() => signOut({ callbackUrl: "/login" }))}
        disabled={pending}
      >
        {pending ? "Signing out..." : "Sign out"}
      </Button>
    </header>
  );
}
