"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";

interface GeminiBalance {
  currency: string;
  amount: number;
  available: number;
  type: string;
  source: string;
  usdValue: number;
}

export function GeminiBalances() {
  const [balances, setBalances] = useState<GeminiBalance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchBalances() {
      try {
        const response = await fetch("/api/integrations/gemini/balances");

        if (!response.ok) {
          throw new Error("Failed to fetch Gemini balances");
        }

        const data = await response.json();
        console.log("Gemini balances received:", data);
        setBalances(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    }

    fetchBalances();
  }, []);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Gemini Balances</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground">Loading...</div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Gemini Balances</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-destructive">Error: {error}</div>
        </CardContent>
      </Card>
    );
  }

  if (balances.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Gemini Balances</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground">No balances found</div>
        </CardContent>
      </Card>
    );
  }

  const totalUSDValue = balances.reduce((sum, balance) => sum + balance.usdValue, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Gemini Balances</span>
          <span className="text-sm font-normal text-muted-foreground">
            Total: {formatCurrency(totalUSDValue * 100)}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {balances.map((balance) => (
          <div key={balance.currency} className="flex items-center justify-between text-sm">
            <div>
              <div className="font-medium">{balance.currency}</div>
              <div className="text-xs text-muted-foreground">Gemini Exchange</div>
            </div>
            <div className="text-right">
              <div className="font-semibold">
                {balance.currency === 'USD' || balance.currency === 'USDC'
                  ? formatCurrency(balance.amount)
                  : `${balance.amount.toFixed(8)} ${balance.currency}`
                }
              </div>
              <div className="text-xs text-muted-foreground">
                {formatCurrency(balance.usdValue * 100)} USD
              </div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}