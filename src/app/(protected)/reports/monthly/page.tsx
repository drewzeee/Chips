import { endOfMonth, format, startOfMonth, subMonths } from "date-fns";
import { prisma } from "@/lib/prisma";
import { getAuthSession } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from "@/components/ui/table";
import { CashflowChart } from "@/components/reports/cashflow-chart";
import { CategoryTrendsSection } from "@/components/reports/category-trends-section";
import { AccountBreakdownSection } from "@/components/reports/account-breakdown-section";
import { formatCurrency } from "@/lib/utils";
import Link from "next/link";
import { MonthSelector } from "@/components/reports/month-selector";

type TransactionWithSplits = {
  date: Date;
  amount: number;
  merchant: string | null;
  reference: string | null;
  splits: {
    amount: number;
    category: {
      id: string;
      name: string;
      type: "INCOME" | "EXPENSE" | "TRANSFER";
    } | null;
  }[];
};

function aggregateTransactions(transactions: TransactionWithSplits[]) {
  const incomeSplits: number[] = [];
  const expenseSplits: number[] = [];
  const categoryTotals = new Map<string, { name: string; type: string; amount: number }>();
  const merchants = new Map<string, { name: string; amount: number }>();

  for (const transaction of transactions) {
    if (transaction.reference &&
        (transaction.reference.startsWith("transfer_") ||
         transaction.reference.startsWith("investment_"))) {
      continue;
    }
    const hasSplits = transaction.splits.length > 0;
    if (hasSplits) {
      for (const split of transaction.splits) {
        const categoryName = split.category?.name ?? "Uncategorized";
        const categoryType = split.category?.type ?? (split.amount >= 0 ? "INCOME" : "EXPENSE");
        const mapKey = `${categoryType}-${categoryName}`;
        const entry = categoryTotals.get(mapKey) ?? { name: categoryName, type: categoryType, amount: 0 };
        entry.amount += categoryType === "EXPENSE" ? Math.abs(split.amount) : split.amount;
        categoryTotals.set(mapKey, entry);
        if (categoryType === "EXPENSE") {
          expenseSplits.push(Math.abs(split.amount));
        } else if (categoryType === "INCOME") {
          incomeSplits.push(split.amount);
        }
      }
    } else {
      if (transaction.amount < 0) {
        expenseSplits.push(Math.abs(transaction.amount));
        const entry = categoryTotals.get("EXPENSE-Uncategorized") ?? {
          name: "Uncategorized",
          type: "EXPENSE",
          amount: 0,
        };
        entry.amount += Math.abs(transaction.amount);
        categoryTotals.set("EXPENSE-Uncategorized", entry);
      } else {
        incomeSplits.push(transaction.amount);
        const entry = categoryTotals.get("INCOME-Uncategorized") ?? {
          name: "Uncategorized",
          type: "INCOME",
          amount: 0,
        };
        entry.amount += transaction.amount;
        categoryTotals.set("INCOME-Uncategorized", entry);
      }
    }

    if (transaction.merchant) {
      const key = transaction.merchant;
      const merchant = merchants.get(key) ?? { name: key, amount: 0 };
      if (transaction.amount < 0) {
        merchant.amount += Math.abs(transaction.amount);
      }
      merchants.set(key, merchant);
    }
  }

  return {
    income: incomeSplits.reduce((sum, value) => sum + value, 0),
    expenses: expenseSplits.reduce((sum, value) => sum + value, 0),
    categories: Array.from(categoryTotals.values()).sort((a, b) => b.amount - a.amount),
    merchants: Array.from(merchants.values()).sort((a, b) => b.amount - a.amount),
  };
}

export default async function MonthlyReportPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const resolvedSearchParams = await searchParams;

  const session = await getAuthSession();
  const userId = session?.user?.id;

  if (!userId) {
    return null;
  }

  const referenceMonth = resolvedSearchParams.month
    ? new Date(`${resolvedSearchParams.month}-01T00:00:00`)
    : new Date();

  const monthStart = startOfMonth(referenceMonth);
  const monthEnd = endOfMonth(referenceMonth);
  const previousStart = startOfMonth(subMonths(referenceMonth, 1));
  const previousEnd = endOfMonth(previousStart);
  const trendStart = startOfMonth(subMonths(referenceMonth, 5));

  const [currentTransactions, previousTransactions, trendTransactions] = await Promise.all([
    prisma.transaction.findMany({
      where: {
        userId,
        date: {
          gte: monthStart,
          lte: monthEnd,
        },
      },
      include: {
        splits: {
          include: {
            category: true,
          },
        },
      },
    }),
    prisma.transaction.findMany({
      where: {
        userId,
        date: {
          gte: previousStart,
          lte: previousEnd,
        },
      },
      include: {
        splits: {
          include: {
            category: true,
          },
        },
      },
    }),
    prisma.transaction.findMany({
      where: {
        userId,
        date: {
          gte: trendStart,
          lte: monthEnd,
        },
      },
      include: {
        splits: {
          include: {
            category: true,
          },
        },
      },
      orderBy: { date: "asc" },
    }),
  ]);

  const current = aggregateTransactions(currentTransactions as TransactionWithSplits[]);
  const previous = aggregateTransactions(previousTransactions as TransactionWithSplits[]);

  const net = current.income - current.expenses;
  const previousNet = previous.income - previous.expenses;
  const netChange = net - previousNet;
  const netChangePercentage = previousNet !== 0 ? (netChange / previousNet) * 100 : 100;

  const monthOptions = Array.from({ length: 12 }).map((_, index) => {
    const date = subMonths(startOfMonth(new Date()), index);
    const value = format(date, "yyyy-MM");
    return { value, label: format(date, "MMMM yyyy") };
  });

  // Generate cashflow chart data
  const monthTimeline = Array.from({ length: 6 }).map((_, idx) => {
    const date = subMonths(monthStart, 5 - idx);
    return {
      key: format(date, "yyyy-MM"),
      label: format(date, "MMM"),
    };
  });

  const trendMap = new Map<string, { income: number; expenses: number }>();
  for (const transaction of trendTransactions as TransactionWithSplits[]) {
    if (transaction.reference &&
        (transaction.reference.startsWith("transfer_") ||
         transaction.reference.startsWith("investment_"))) {
      continue;
    }
    const key = format(transaction.date, "yyyy-MM");
    const entry = trendMap.get(key) ?? { income: 0, expenses: 0 };
    if (transaction.splits.length > 0) {
      for (const segment of transaction.splits) {
        if (segment.category?.type === "EXPENSE") {
          entry.expenses += Math.abs(segment.amount);
        } else if (segment.category?.type === "INCOME") {
          entry.income += segment.amount;
        }
      }
    } else {
      if (transaction.amount < 0) {
        entry.expenses += Math.abs(transaction.amount);
      } else {
        entry.income += transaction.amount;
      }
    }
    trendMap.set(key, entry);
  }

  const chartData = monthTimeline.map(({ key, label }) => {
    const entry = trendMap.get(key) ?? { income: 0, expenses: 0 };
    return {
      label,
      income: entry.income,
      expenses: entry.expenses,
    };
  });


  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Monthly summary</h1>
          <p className="text-sm text-gray-500">Detailed breakdown of income and expenses by category.</p>
        </div>
        <MonthSelector value={format(monthStart, "yyyy-MM")} options={monthOptions} />
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle>Total income</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold">{formatCurrency(current.income)}</p>
            <p className="text-sm text-gray-500">Month to date</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Total expenses</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold">{formatCurrency(current.expenses)}</p>
            <p className="text-sm text-gray-500">Month to date</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Net cash flow</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold">{formatCurrency(net)}</p>
            <p className="text-sm text-gray-500">
              {netChange >= 0 ? "+" : "-"}
              {formatCurrency(Math.abs(netChange))} vs previous month ({netChangePercentage.toFixed(1)}%)
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Report export</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-gray-600">
            <p>Need more detail? Export all transactions for this month.</p>
            <Link
              className="text-blue-600 hover:underline"
              href={`/api/transactions?from=${format(monthStart, "yyyy-MM-dd")}&to=${format(monthEnd, "yyyy-MM-dd")}`}
            >
              Download CSV
            </Link>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Cash flow trend</CardTitle>
        </CardHeader>
        <CardContent>
          <CashflowChart data={chartData} />
        </CardContent>
      </Card>

      <AccountBreakdownSection />

      <CategoryTrendsSection />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Expense breakdown</CardTitle>
          </CardHeader>
          <CardContent className="max-h-[360px] overflow-y-auto">
            <Table>
              <TableHead>
                <TableRow>
                  <TableHeaderCell>Category</TableHeaderCell>
                  <TableHeaderCell className="text-right">Spend</TableHeaderCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {current.categories
                  .filter((category) => category.type === "EXPENSE")
                  .map((category) => (
                    <TableRow key={`category-${category.name}`}>
                      <TableCell>{category.name}</TableCell>
                      <TableCell className="text-right">{formatCurrency(category.amount)}</TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Top merchants</CardTitle>
          </CardHeader>
          <CardContent className="max-h-[360px] overflow-y-auto">
            <Table>
              <TableHead>
                <TableRow>
                  <TableHeaderCell>Merchant</TableHeaderCell>
                  <TableHeaderCell className="text-right">Spend</TableHeaderCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {current.merchants.slice(0, 10).map((merchant) => (
                  <TableRow key={`merchant-${merchant.name}`}>
                    <TableCell>{merchant.name}</TableCell>
                    <TableCell className="text-right">{formatCurrency(merchant.amount)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
