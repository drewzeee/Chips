"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ResponsiveContainer,
  LineChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  Line,
} from "recharts";
import { formatCurrency } from "@/lib/utils";

const COLORS = ["#6366f1", "#ec4899", "#10b981", "#f97316", "#0ea5e9", "#8b5cf6"] as const;

type CategoryType = "INCOME" | "EXPENSE";

export interface CategoryTrendMonth {
  key: string;
  label: string;
}

export interface CategoryTrendSeries {
  id: string;
  name: string;
  type: CategoryType;
  total: number;
  data: { month: string; value: number }[];
}

interface CategoryTrendChartProps {
  months: CategoryTrendMonth[];
  series: CategoryTrendSeries[];
}

export function CategoryTrendChart({ months, series }: CategoryTrendChartProps) {
  const [activeType, setActiveType] = useState<CategoryType>("EXPENSE");
  const byId = useMemo(() => {
    const map = new Map<string, CategoryTrendSeries>();
    for (const item of series) {
      map.set(item.id, item);
    }
    return map;
  }, [series]);

  const sortedByType = useMemo(() => {
    return series
      .filter((item) => item.type === activeType)
      .sort((a, b) => b.total - a.total);
  }, [series, activeType]);

  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  useEffect(() => {
    const availableIds = sortedByType.map((item) => item.id);
    setSelectedIds((prev) => {
      const filtered = prev.filter((id) => availableIds.includes(id));
      if (filtered.length > 0) {
        return filtered;
      }
      return availableIds.slice(0, Math.min(3, availableIds.length));
    });
  }, [sortedByType]);

  const chartData = useMemo(() => {
    return months.map(({ key, label }) => {
      const point: Record<string, number | string> = { label };
      for (const id of selectedIds) {
        const seriesEntry = byId.get(id);
        if (!seriesEntry) continue;
        const value = seriesEntry.data.find((item) => item.month === key)?.value ?? 0;
        point[id] = value;
      }
      return point;
    });
  }, [months, selectedIds, byId]);

  const handleToggleCategory = (id: string) => {
    setSelectedIds((prev) => {
      if (prev.includes(id)) {
        if (prev.length === 1) {
          return prev; // keep at least one line visible
        }
        return prev.filter((existing) => existing !== id);
      }
      const next = [...prev, id];
      if (next.length > COLORS.length) {
        next.shift();
      }
      return next;
    });
  };

  const activeCategories = sortedByType.slice(0, 10);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {(["EXPENSE", "INCOME"] as CategoryType[]).map((type) => (
          <button
            key={type}
            type="button"
            onClick={() => setActiveType(type)}
            className={`rounded-full border px-3 py-1 text-sm transition ${
              activeType === type
                ? "border-blue-500 bg-blue-500/10 text-blue-600"
                : "border-gray-300 text-gray-600 hover:border-gray-400"
            }`}
          >
            {type === "EXPENSE" ? "Expenses" : "Income"}
          </button>
        ))}
      </div>

      {activeCategories.length === 0 ? (
        <p className="text-sm text-gray-500">No {activeType.toLowerCase()} categories available for the selected range.</p>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            {activeCategories.map((category) => {
              const selected = selectedIds.includes(category.id);
              const colorIndex = Math.max(selectedIds.indexOf(category.id), 0);
              const color = COLORS[colorIndex % COLORS.length];
              return (
                <button
                  key={category.id}
                  type="button"
                  onClick={() => handleToggleCategory(category.id)}
                  className={`rounded-full border px-3 py-1 text-sm transition ${
                    selected
                      ? "border-transparent text-white"
                      : "border-gray-300 text-gray-600 hover:border-gray-400"
                  }`}
                  style={selected ? { backgroundColor: color } : undefined}
                >
                  <span className="font-medium">{category.name}</span>
                  <span className="ml-2 text-xs opacity-90">{formatCurrency(category.total)}</span>
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
                  const category = byId.get(dataKey as string);
                  return [formatCurrency(value as number), category?.name ?? "Category"];
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
                formatter={(value) => byId.get(value as string)?.name ?? (value as string)}
              />
              {selectedIds.map((id, index) => {
                const color = COLORS[index % COLORS.length];
                return <Line key={id} type="monotone" dataKey={id} stroke={color} strokeWidth={2} dot={false} />;
              })}
            </LineChart>
          </ResponsiveContainer>
        </>
      )}
    </div>
  );
}
