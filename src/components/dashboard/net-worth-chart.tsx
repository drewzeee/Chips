"use client";

import {
  AreaChart,
  Area,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

interface NetWorthChartProps {
  data: { label: string; value: number }[];
  currency?: string;
}

const formatter = (value: number, currency: string) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value / 100);

export function NetWorthChart({ data, currency = "USD" }: NetWorthChartProps) {
  const values = data.map(d => d.value);
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const range = maxValue - minValue;
  const padding = Math.max(range * 0.1, 1000);

  const yAxisDomain = [
    Math.max(0, minValue - padding),
    maxValue + padding
  ];

  return (
    <ResponsiveContainer width="100%" height={260}>
      <AreaChart data={data} margin={{ top: 10, left: 0, right: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="netWorthGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.3} />
            <stop offset="95%" stopColor="var(--primary)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
        <XAxis dataKey="label" stroke="var(--muted-foreground)" fontSize={12} />
        <YAxis
          stroke="var(--muted-foreground)"
          fontSize={12}
          tickFormatter={(value) => formatter(value as number, currency)}
          width={80}
          domain={yAxisDomain}
        />
        <Tooltip
          formatter={(value: number) => formatter(value, currency)}
          contentStyle={{
            background: "var(--card)",
            border: `1px solid var(--border)`,
            borderRadius: 12,
            boxShadow: "0 20px 32px -24px rgba(15,23,42,0.45)",
            color: "var(--card-foreground)",
          }}
          labelStyle={{ color: "var(--muted-foreground)" }}
        />
        <Area
          type="monotone"
          dataKey="value"
          stroke="var(--primary)"
          strokeWidth={2}
          fill="url(#netWorthGradient)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
