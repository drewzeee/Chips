"use client";

import { ResponsiveContainer, LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip } from "recharts";
import { format } from "date-fns";

interface TotalValuePoint {
  date: string;
  totalValue: number;
}

export function TotalValueChart({ data }: { data: TotalValuePoint[] }) {
  const formatTooltip = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };

  const formatYAxis = (value: number) => {
    if (value >= 1000000) {
      return `$${(value / 1000000).toFixed(1)}M`;
    }
    if (value >= 1000) {
      return `$${(value / 1000).toFixed(0)}k`;
    }
    return `$${value.toFixed(0)}`;
  };

  const formatXAxis = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return format(date, "MMM dd");
    } catch {
      return dateStr;
    }
  };

  return (
    <ResponsiveContainer width="100%" height={320}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
        <XAxis
          dataKey="date"
          stroke="#6b7280"
          fontSize={12}
          tickFormatter={formatXAxis}
        />
        <YAxis
          stroke="#6b7280"
          fontSize={12}
          tickFormatter={formatYAxis}
        />
        <Tooltip
          formatter={(value: number) => [formatTooltip(value), "Total Value"]}
          labelFormatter={(dateStr: string) => {
            try {
              const date = new Date(dateStr);
              return format(date, "MMMM dd, yyyy");
            } catch {
              return dateStr;
            }
          }}
          contentStyle={{
            backgroundColor: "#ffffff",
            border: "1px solid #e5e7eb",
            borderRadius: "6px",
            boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)"
          }}
        />
        <Line
          type="monotone"
          dataKey="totalValue"
          stroke="#3b82f6"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4, fill: "#3b82f6" }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}