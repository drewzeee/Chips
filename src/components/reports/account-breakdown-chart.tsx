"use client";

import { ResponsiveContainer, LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, Legend } from "recharts";

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

// Generate highly distinct colors optimized for dark backgrounds
const generateColors = (count: number): string[] => {
  const colors = [
    "#00ffff", // electric cyan
    "#ff4757", // bright red
    "#2ed573", // bright green
    "#ffa502", // bright orange
    "#3742fa", // electric blue
    "#ff3838", // neon red
    "#7bed9f", // mint
    "#feca57", // yellow
    "#ff6348", // tomato
    "#70a1ff", // light blue
    "#5352ed", // purple
    "#ff4081", // hot pink
    "#26a69a", // teal
    "#ffb74d", // orange
    "#42a5f5", // blue
    "#ab47bc", // violet
    "#ef5350", // red
    "#66bb6a", // green
    "#ffca28", // amber
    "#29b6f6", // light blue
  ];

  if (count <= colors.length) {
    return colors.slice(0, count);
  }

  // Generate more vibrant colors with maximum contrast
  const extraColors = [];
  for (let i = colors.length; i < count; i++) {
    const hue = (i * 137.508) % 360;
    extraColors.push(`hsl(${hue}, 100%, 70%)`); // Maximum saturation, bright
  }

  return [...colors, ...extraColors];
};

export function AccountBreakdownChart({ data, accountNames }: AccountBreakdownChartProps) {
  const colors = generateColors(accountNames.length);

  const formatTooltip = (value: number, name: string) => {
    return [
      new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
      }).format(value),
      name
    ];
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

  return (
    <ResponsiveContainer width="100%" height={400}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
        <XAxis
          dataKey="displayMonth"
          stroke="#6b7280"
          fontSize={12}
        />
        <YAxis
          stroke="#6b7280"
          fontSize={12}
          tickFormatter={formatYAxis}
        />
        <Tooltip
          formatter={formatTooltip}
          labelFormatter={(label) => `Month: ${label}`}
          contentStyle={{
            backgroundColor: "#1f2937",
            border: "1px solid #374151",
            borderRadius: "8px",
            boxShadow: "0 10px 25px rgba(0, 0, 0, 0.5)",
            color: "#f9fafb"
          }}
          itemStyle={{
            color: "#f9fafb"
          }}
          labelStyle={{
            color: "#e5e7eb",
            fontWeight: "600"
          }}
        />
        <Legend />

        {accountNames.map((accountName, index) => (
          <Line
            key={accountName}
            type="monotone"
            dataKey={`accounts.${accountName}`}
            stroke={colors[index]}
            strokeWidth={4}
            dot={{
              r: 5,
              fill: colors[index],
              strokeWidth: 3,
              stroke: "#1a1a1a",
              filter: "drop-shadow(0 1px 3px rgba(0,0,0,0.5))"
            }}
            activeDot={{
              r: 8,
              fill: colors[index],
              strokeWidth: 4,
              stroke: "#1a1a1a",
              filter: "drop-shadow(0 3px 6px rgba(0,0,0,0.6))"
            }}
            name={accountName}
            connectNulls={false}
            strokeDasharray={index % 3 === 2 ? "8 4" : undefined} // Add dashed lines for every 3rd account
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}