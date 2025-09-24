"use client";

import { ResponsiveContainer, BarChart, Bar, CartesianGrid, XAxis, YAxis, Tooltip, Legend } from "recharts";

interface CashflowPoint {
  label: string;
  income: number;
  expenses: number;
}

export function CashflowChart({ data }: { data: CashflowPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--secondary)" opacity={0.5} />
        <XAxis dataKey="label" stroke="#6b7280" fontSize={12} />
        <YAxis
          stroke="#6b7280"
          fontSize={12}
          tickFormatter={(value) => `$${Math.round((value as number) / 100)}`}
        />
        <Tooltip
          cursor={false}
          formatter={(value: number) =>
            new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value / 100)
          }
          contentStyle={{
            background: "var(--card)",
            border: `1px solid var(--border)`,
            borderRadius: 12,
            boxShadow: "0 20px 32px -24px rgba(15,23,42,0.45)",
            color: "var(--card-foreground)",
          }}
          labelStyle={{ color: "var(--muted-foreground)" }}
        />
        <Legend />
        <Bar dataKey="income" fill="#22c55e" name="Income" />
        <Bar dataKey="expenses" fill="#ef4444" name="Expenses" />
      </BarChart>
    </ResponsiveContainer>
  );
}
