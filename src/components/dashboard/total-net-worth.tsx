"use client";

import { useState, useEffect } from "react";
import { formatCurrency } from "@/lib/utils";

interface TotalNetWorthProps {
  traditionalNetWorth: number;
  accountCount: number;
}

export function TotalNetWorth({ traditionalNetWorth, accountCount }: TotalNetWorthProps) {
  const [externalBalance, setExternalBalance] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchExternalBalance() {
      try {
        const response = await fetch("/api/external-balances/total");
        if (response.ok) {
          const data = await response.json();
          setExternalBalance(data.totalUSD || 0);
        }
      } catch (error) {
        console.error("Failed to fetch external balance:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchExternalBalance();
  }, []);

  // traditionalNetWorth is in cents, externalBalance is in dollars
  const totalNetWorth = traditionalNetWorth + (externalBalance * 100);

  if (loading) {
    return (
      <div className="text-center">
        <div className="text-xs text-muted-foreground mb-1">Total Net Worth</div>
        <div className="text-xl font-bold">Loading...</div>
      </div>
    );
  }

  return (
    <div>
      <div className="text-3xl font-semibold text-[var(--card-foreground)]">
        {formatCurrency(totalNetWorth)}
      </div>
      <div className="mt-1 text-sm text-[var(--muted-foreground)]">
        Across {accountCount} accounts{externalBalance > 0 ? ' + crypto' : ''}
      </div>
    </div>
  );
}