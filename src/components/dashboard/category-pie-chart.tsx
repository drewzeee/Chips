"use client";

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";

interface DataPoint {
  name: string;
  value: number;
  [key: string]: string | number;
}

const COLORS = [
  "var(--primary)",
  "#f97316",
  "#14b8a6",
  "#a855f7",
  "#f43f5e",
  "#0ea5e9",
];

const tooltipFormatter = (value: number, name: string) => [
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format((value as number) / 100),
  name,
];

export function CategoryPieChart({ data }: { data: DataPoint[] }) {
  if (data.length === 0) {
    return <p className="text-sm text-[var(--muted-foreground)]">No categorized spending this month.</p>;
  }

  return (
    <ResponsiveContainer width="100%" height={240}>
      <PieChart>
        <Pie
          data={data}
          dataKey="value"
          nameKey="name"
          cx="50%"
          cy="50%"
          outerRadius={90}
          innerRadius={40}
          stroke="var(--background)"
        >
          {data.map((entry, index) => (
            <Cell key={entry.name} fill={COLORS[index % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip
          formatter={tooltipFormatter}
          contentStyle={{
            background: "var(--background)",
            border: `1px solid var(--border)`,
            borderRadius: 8,
            boxShadow: "0 10px 25px -5px rgba(0,0,0,0.25)",
            color: "var(--foreground)",
            fontSize: "14px",
            fontWeight: "500",
            padding: "8px 12px",
          }}
          labelStyle={{
            color: "var(--foreground)",
            fontWeight: "600",
            marginBottom: "4px",
          }}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
