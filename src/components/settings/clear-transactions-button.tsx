"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";

export function ClearTransactionsButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleClear = () => {
    if (pending) return;
    const confirmed = window.confirm(
      "This will permanently delete every transaction you have recorded. Continue?"
    );

    if (!confirmed) {
      return;
    }

    startTransition(async () => {
      setError(null);
      setSuccess(null);
      const response = await fetch("/api/transactions", {
        method: "DELETE",
      });

      if (!response.ok) {
        let message = "Failed to clear transactions.";
        try {
          const body = await response.json();
          if (body?.error) {
            message = typeof body.error === "string" ? body.error : "Unable to clear transactions.";
          }
        } catch {
          // ignore JSON parse errors and keep default message
        }
        setError(message);
        return;
      }

      setSuccess("All transactions removed.");
      router.refresh();
    });
  };

  return (
    <div className="space-y-3">
      <Button
        variant="destructive"
        size="sm"
        onClick={handleClear}
        disabled={pending}
        className="px-4"
      >
        {pending ? "Clearing…" : "Clear all transactions"}
      </Button>
      {(error || success) && (
        <p
          className={
            error
              ? "text-sm font-medium text-rose-500"
              : "text-sm font-medium text-emerald-500"
          }
        >
          {error ?? success}
        </p>
      )}
    </div>
  );
}
