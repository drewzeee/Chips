"use client";

import { useEffect, useState } from "react";
import { format, startOfMonth, subMonths } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { CategoryTrendChart, type CategoryTrendSeries, type CategoryTrendMonth } from "./category-trend-chart";

interface CategoryTrendsApiResponse {
  months: CategoryTrendMonth[];
  series: CategoryTrendSeries[];
}

export function CategoryTrendsSection() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<CategoryTrendsApiResponse | null>(null);

  // Default to last 6 months
  const defaultEndDate = startOfMonth(new Date());
  const defaultStartDate = subMonths(defaultEndDate, 5);

  const [fromDate, setFromDate] = useState(format(defaultStartDate, "yyyy-MM-dd"));
  const [toDate, setToDate] = useState(format(defaultEndDate, "yyyy-MM-dd"));

  const fetchData = async (from: string, to: string) => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams({
        from,
        to
      });

      const response = await fetch(`/api/reports/category-trends?${params}`);

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.error || "Failed to fetch category trends");
      }

      const result: CategoryTrendsApiResponse = await response.json();
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData(fromDate, toDate);
  }, [fromDate, toDate]); // Re-run when dates change

  const handleDateRangeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchData(fromDate, toDate);
  };

  const handlePresetRange = (months: number) => {
    const endDate = startOfMonth(new Date());
    const startDate = subMonths(endDate, months - 1);
    const newFromDate = format(startDate, "yyyy-MM-dd");
    const newToDate = format(endDate, "yyyy-MM-dd");

    setFromDate(newFromDate);
    setToDate(newToDate);
    fetchData(newFromDate, newToDate);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Category trends</CardTitle>
        <div className="space-y-4">
          <form onSubmit={handleDateRangeSubmit} className="flex flex-wrap items-end gap-4">
            <div className="space-y-2">
              <Label htmlFor="from-date">From</Label>
              <Input
                id="from-date"
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="w-40"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="to-date">To</Label>
              <Input
                id="to-date"
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="w-40"
              />
            </div>
            <Button type="submit" disabled={loading}>
              {loading ? "Loading..." : "Update"}
            </Button>
          </form>

          <div className="flex flex-wrap gap-2">
            <span className="text-sm text-gray-600 dark:text-gray-400">Quick ranges:</span>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => handlePresetRange(3)}
              disabled={loading}
            >
              Last 3 months
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => handlePresetRange(6)}
              disabled={loading}
            >
              Last 6 months
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => handlePresetRange(12)}
              disabled={loading}
            >
              Last 12 months
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading && (
          <div className="flex items-center justify-center h-48">
            <p className="text-gray-500">Loading category trends...</p>
          </div>
        )}

        {error && (
          <div className="flex items-center justify-center h-48">
            <p className="text-red-600 dark:text-red-400">{error}</p>
          </div>
        )}

        {data && !loading && (
          <>
            {data.series.length === 0 ? (
              <div className="flex items-center justify-center h-48">
                <p className="text-gray-500 dark:text-gray-400">
                  No category data available for the selected date range.
                </p>
              </div>
            ) : (
              <CategoryTrendChart months={data.months} series={data.series} />
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}