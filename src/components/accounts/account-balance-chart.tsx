"use client";

import { ResponsiveContainer, LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip } from "recharts";
import { formatCurrency } from "@/lib/utils";

interface BalancePoint {
  asOf: string;
  balance: number;
  source: string | null;
}

function formatLabel(dateIso: string) {
  const date = new Date(dateIso);
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function AccountBalanceChart({
  history,
  currency,
}: {
  history: BalancePoint[];
  currency: string;
}) {
  const data = history
    .slice()
    .sort((a, b) => new Date(a.asOf).getTime() - new Date(b.asOf).getTime())
    .map((entry) => ({
      label: formatLabel(entry.asOf),
      balance: entry.balance,
      source: entry.source,
      asOf: entry.asOf,
    }));

  if (data.length === 0) {
    return null;
  }

  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={data}>
        <CartesianGrid stroke="#e5e7eb" strokeDasharray="3 3" />
        <XAxis dataKey="label" stroke="#6b7280" fontSize={12} />
        <YAxis
          stroke="#6b7280"
          fontSize={12}
          tickFormatter={(value) => formatCurrency(value as number, currency)}
        />
        <Tooltip
          formatter={(value: number) => formatCurrency(value, currency)}
          labelFormatter={(_, payload) => {
            const point = payload?.[0]?.payload as (typeof data)[number] | undefined;
            if (!point) return "";
            return new Date(point.asOf).toLocaleDateString();
          }}
        />
        <Line type="monotone" dataKey="balance" stroke="#6366f1" strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}
