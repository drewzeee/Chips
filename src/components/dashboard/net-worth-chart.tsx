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
import {
  tooltipContentStyle,
  tooltipItemStyle,
  tooltipLabelStyle,
} from "../charts/tooltip-styles";

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

const yAxisFormatter = (value: number, currency: string) => {
  const dollars = value / 100;
  const thousands = dollars / 1000;
  const symbol = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(0).replace(/[\d.,]/g, '').trim();

  return `${symbol}${Math.round(thousands)}k`;
};

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

  // Generate tick values rounded to nearest thousand
  const generateTicks = () => {
    const min = yAxisDomain[0];
    const max = yAxisDomain[1];
    const minDollars = min / 100;
    const maxDollars = max / 100;
    const minRounded = Math.floor(minDollars / 1000) * 1000;
    const maxRounded = Math.ceil(maxDollars / 1000) * 1000;
    const step = Math.ceil((maxRounded - minRounded) / 5 / 1000) * 1000;

    const ticks = [];
    for (let i = minRounded; i <= maxRounded; i += step) {
      ticks.push(i * 100); // Convert back to cents
    }
    return ticks;
  };

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
          tickFormatter={(value) => yAxisFormatter(value as number, currency)}
          width={80}
          domain={yAxisDomain}
          ticks={generateTicks()}
        />
        <Tooltip
          formatter={(value: number) => formatter(value, currency)}
          contentStyle={tooltipContentStyle}
          labelStyle={tooltipLabelStyle}
          itemStyle={tooltipItemStyle}
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
