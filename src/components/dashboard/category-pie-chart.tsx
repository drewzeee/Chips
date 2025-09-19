"use client";

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";

interface DataPoint {
  name: string;
  value: number;
  [key: string]: string | number;
}

const COLORS = ["#2563eb", "#f97316", "#22c55e", "#ec4899", "#8b5cf6", "#0ea5e9"];

const tooltipFormatter = (value: number, name: string) => [
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format((value as number) / 100),
  name,
];

export function CategoryPieChart({ data }: { data: DataPoint[] }) {
  if (data.length === 0) {
    return <p className="text-sm text-gray-500">No categorized spending this month.</p>;
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
        >
          {data.map((entry, index) => (
            <Cell key={entry.name} fill={COLORS[index % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip formatter={tooltipFormatter} />
      </PieChart>
    </ResponsiveContainer>
  );
}
