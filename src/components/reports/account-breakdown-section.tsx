"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { AccountBreakdownChart } from "./account-breakdown-chart";

interface AccountBreakdownData {
  month: string;
  displayMonth: string;
  totalValue: number;
  accounts: Record<string, number>;
}

interface ApiResponse {
  data: AccountBreakdownData[];
  accountNames: string[];
}

const timeRangeOptions = [
  { value: "6", label: "Last 6 months" },
  { value: "12", label: "Last 12 months" },
  { value: "24", label: "Last 2 years" },
  { value: "36", label: "Last 3 years" },
];

export function AccountBreakdownSection() {
  const [data, setData] = useState<AccountBreakdownData[]>([]);
  const [accountNames, setAccountNames] = useState<string[]>([]);
  const [visibleAccounts, setVisibleAccounts] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState("12");

  const fetchData = async (months: string) => {
    try {
      setLoading(true);
      const response = await fetch(`/api/accounts/breakdown-values?months=${months}`);
      if (!response.ok) {
        throw new Error('Failed to fetch account breakdown data');
      }
      const result: ApiResponse = await response.json();
      setData(result.data);
      setAccountNames(result.accountNames);
      // Initialize all accounts as visible when data loads
      setVisibleAccounts(new Set(result.accountNames));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setData([]);
      setAccountNames([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData(timeRange);
  }, [timeRange]);

  const handleTimeRangeChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    setTimeRange(event.target.value);
  };

  const toggleAccountVisibility = (accountName: string) => {
    setVisibleAccounts(prev => {
      const newSet = new Set(prev);
      if (newSet.has(accountName)) {
        newSet.delete(accountName);
      } else {
        newSet.add(accountName);
      }
      return newSet;
    });
  };

  const toggleAllAccounts = () => {
    if (visibleAccounts.size === accountNames.length) {
      setVisibleAccounts(new Set());
    } else {
      setVisibleAccounts(new Set(accountNames));
    }
  };

  const filteredAccountNames = accountNames.filter(name => visibleAccounts.has(name));

  if (loading) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle>Account Values Over Time</CardTitle>
          <Select disabled className="w-40">
            <option>Loading...</option>
          </Select>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-96">
            <div className="text-gray-500">Loading account data...</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle>Account Values Over Time</CardTitle>
          <Select value={timeRange} onChange={handleTimeRangeChange} className="w-40">
            {timeRangeOptions.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-96">
            <div className="text-red-500">Error: {error}</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (data.length === 0) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle>Account Values Over Time</CardTitle>
          <Select value={timeRange} onChange={handleTimeRangeChange} className="w-40">
            {timeRangeOptions.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-96">
            <div className="text-gray-500">No account data available for this time period</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <CardTitle>Account Values Over Time</CardTitle>
        <Select value={timeRange} onChange={handleTimeRangeChange} className="w-40">
          {timeRangeOptions.map(option => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Account Filter Section */}
          <div className="border border-gray-300 dark:border-gray-700 rounded-lg p-4 bg-gray-50 dark:bg-gray-800/50 backdrop-blur-sm">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-sm font-semibold text-gray-800 dark:text-gray-200">Filter Accounts</h4>
              <button
                onClick={toggleAllAccounts}
                className="text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 font-medium px-3 py-1 rounded-md bg-blue-50 hover:bg-blue-100 dark:bg-gray-700/50 dark:hover:bg-gray-700 transition-colors"
              >
                {visibleAccounts.size === accountNames.length ? 'Hide All' : 'Show All'}
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
              {accountNames.map((accountName) => (
                <label
                  key={accountName}
                  className="flex items-center space-x-3 text-sm cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700/30 p-3 rounded-md transition-colors border border-gray-200 dark:border-gray-700/50 hover:border-gray-300 dark:hover:border-gray-600"
                >
                  <input
                    type="checkbox"
                    checked={visibleAccounts.has(accountName)}
                    onChange={() => toggleAccountVisibility(accountName)}
                    className="rounded border-gray-400 dark:border-gray-600 bg-white dark:bg-gray-700 text-blue-600 focus:ring-blue-500 focus:ring-offset-white dark:focus:ring-offset-gray-800 w-4 h-4"
                  />
                  <span className="text-gray-900 dark:text-gray-100 font-medium flex-1">{accountName}</span>
                </label>
              ))}
            </div>
            {filteredAccountNames.length === 0 && (
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-3 italic">Select at least one account to display data.</p>
            )}
          </div>

          {/* Chart */}
          {filteredAccountNames.length > 0 ? (
            <AccountBreakdownChart data={data} accountNames={filteredAccountNames} />
          ) : (
            <div className="flex items-center justify-center h-96 bg-gray-100 dark:bg-gray-50 rounded-lg">
              <div className="text-gray-600 dark:text-gray-500">Select accounts to view chart</div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}