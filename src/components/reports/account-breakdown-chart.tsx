"use client";

import { useEffect, useMemo, useState } from "react";
import { ResponsiveContainer, LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, Legend } from "recharts";
import { formatCurrency } from "@/lib/utils";

const COLORS = ["#6366f1", "#ec4899", "#10b981", "#f97316", "#0ea5e9", "#8b5cf6"] as const;

interface AccountBreakdownData {
  month: string;
  displayMonth: string;
  totalValue: number;
  accounts: Record<string, number>;
}

interface AccountBreakdownChartProps {
  data: AccountBreakdownData[];
  accountNames: string[];
}

export function AccountBreakdownChart({ data, accountNames }: AccountBreakdownChartProps) {
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>([]);

  // Calculate account totals for sorting and display
  const accountTotals = useMemo(() => {
    return accountNames.map(accountName => {
      const total = data.reduce((sum, monthData) => {
        return sum + (monthData.accounts[accountName] || 0);
      }, 0);
      return { name: accountName, total };
    }).sort((a, b) => b.total - a.total);
  }, [data, accountNames]);

  // Initialize with top 3 accounts
  useEffect(() => {
    if (accountTotals.length > 0 && selectedAccounts.length === 0) {
      setSelectedAccounts(accountTotals.slice(0, Math.min(3, accountTotals.length)).map(a => a.name));
    }
  }, [accountTotals, selectedAccounts.length]);

  // Transform data for the chart
  const chartData = useMemo(() => {
    return data.map(monthData => {
      const point: Record<string, string | number> = { label: monthData.displayMonth };
      selectedAccounts.forEach(accountName => {
        point[accountName] = (monthData.accounts[accountName] || 0) * 100; // Convert to cents for formatting
      });
      return point;
    });
  }, [data, selectedAccounts]);

  const handleToggleAccount = (accountName: string) => {
    setSelectedAccounts(prev => {
      if (prev.includes(accountName)) {
        if (prev.length === 1) {
          return prev; // keep at least one account visible
        }
        return prev.filter(existing => existing !== accountName);
      }
      const next = [...prev, accountName];
      if (next.length > COLORS.length) {
        next.shift();
      }
      return next;
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {accountTotals.slice(0, 10).map((account) => {
          const selected = selectedAccounts.includes(account.name);
          const colorIndex = Math.max(selectedAccounts.indexOf(account.name), 0);
          const color = COLORS[colorIndex % COLORS.length];
          return (
            <button
              key={account.name}
              type="button"
              onClick={() => handleToggleAccount(account.name)}
              className={`rounded-full border px-3 py-1 text-sm transition ${
                selected
                  ? "border-transparent text-white"
                  : "border-gray-300 text-gray-600 hover:border-gray-400"
              }`}
              style={selected ? { backgroundColor: color } : undefined}
            >
              <span className="font-medium">{account.name}</span>
            </button>
          );
        })}
      </div>

      <ResponsiveContainer width="100%" height={320}>
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--secondary)" opacity={0.5} />
          <XAxis dataKey="label" stroke="#6b7280" fontSize={12} />
          <YAxis
            stroke="#6b7280"
            fontSize={12}
            tickFormatter={(value) => `$${Math.round((value as number) / 100)}`}
          />
          <Tooltip
            formatter={(value, dataKey) => {
              return [formatCurrency(value as number), dataKey as string];
            }}
            contentStyle={{
              background: "var(--card)",
              border: `1px solid var(--border)`,
              borderRadius: 12,
              boxShadow: "0 20px 32px -24px rgba(15,23,42,0.45)",
              color: "var(--card-foreground)",
            }}
            labelStyle={{ color: "var(--muted-foreground)" }}
          />
          <Legend
            formatter={(value) => value as string}
          />
          {selectedAccounts.map((accountName, index) => {
            const color = COLORS[index % COLORS.length];
            return (
              <Line
                key={accountName}
                type="monotone"
                dataKey={accountName}
                stroke={color}
                strokeWidth={2}
                dot={false}
              />
            );
          })}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}