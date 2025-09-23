import {
  addMonths,
  differenceInMonths,
  endOfMonth,
  format,
  startOfMonth,
  subMonths,
  isValid,
  parseISO,
} from "date-fns";
import { prisma } from "@/lib/prisma";
import { formatCurrency } from "@/lib/utils";
import { NetWorthChart } from "@/components/dashboard/net-worth-chart";
import { CategoryPieChart } from "@/components/dashboard/category-pie-chart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from "@/components/ui/table";
import { getAuthSession } from "@/lib/auth";
import Link from "next/link";
import {
  DEFAULT_NET_WORTH_RANGE,
  NET_WORTH_RANGE_OPTIONS,
  type NetWorthRangeValue,
} from "@/lib/dashboard";
import { NetWorthRangeSelector } from "@/components/dashboard/net-worth-range-selector";
import { calculateInvestmentAccountBalance } from "@/lib/investment-calculations";

function sumValues(values: number[]) {
  return values.reduce((total, value) => total + value, 0);
}

interface DashboardPageProps {
  searchParams?: Record<string, string | string[] | undefined>;
}

function resolveReferenceDate(searchParams?: Record<string, string | string[] | undefined>) {
  const raw = searchParams?.date;
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (typeof value === "string") {
    const parsed = parseISO(value);
    if (isValid(parsed)) {
      return parsed;
    }
  }
  return new Date();
}

function resolveTrendRange(searchParams?: Record<string, string | string[] | undefined>) {
  const raw = searchParams?.range;
  const value = Array.isArray(raw) ? raw[0] : raw;
  const allowed = new Set(NET_WORTH_RANGE_OPTIONS.map((option) => option.value));
  return allowed.has(value as NetWorthRangeValue)
    ? (value as NetWorthRangeValue)
    : DEFAULT_NET_WORTH_RANGE;
}

export default async function DashboardPage({ searchParams }: DashboardPageProps = {}) {
  const session = await getAuthSession();
  const userId = session?.user?.id;

  if (!userId) {
    return null;
  }

  const now = resolveReferenceDate(searchParams);
  const rangeKey = resolveTrendRange(searchParams);
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);

  let trendStart = startOfMonth(subMonths(now, 5));
  let trendMonths = 6;

  if (rangeKey === "1y") {
    trendMonths = 12;
    trendStart = startOfMonth(subMonths(now, trendMonths - 1));
  } else if (rangeKey === "2y") {
    trendMonths = 24;
    trendStart = startOfMonth(subMonths(now, trendMonths - 1));
  } else if (rangeKey === "all") {
    const earliest = await prisma.transaction.findFirst({
      where: { userId },
      orderBy: { date: "asc" },
      select: { date: true },
    });

    if (earliest?.date) {
      trendStart = startOfMonth(earliest.date);
      trendMonths = differenceInMonths(startOfMonth(now), trendStart) + 1;
    } else {
      trendMonths = 6;
      trendStart = startOfMonth(subMonths(now, trendMonths - 1));
    }
  } else {
    trendStart = startOfMonth(subMonths(now, trendMonths - 1));
  }

  if (trendMonths < 1) {
    trendMonths = 1;
  }

  const [accounts, investmentAccounts, transactionTotals, monthlySplits, uncategorizedTransactions, recentTransactions, preRangeSums, trendTransactions] =
    await Promise.all([
      prisma.financialAccount.findMany({
        where: { userId },
        orderBy: { name: "asc" },
      }),
      prisma.investmentAccount.findMany({
        where: { userId },
        include: {
          trades: {
            orderBy: { occurredAt: "desc" },
          },
        },
      }),
      prisma.transaction.groupBy({
        by: ["accountId"],
        where: { userId },
        _sum: { amount: true },
      }),
      prisma.transactionSplit.findMany({
        where: {
          userId,
          transaction: {
            date: {
              gte: monthStart,
              lte: monthEnd,
            },
          },
        },
        include: {
          category: true,
          transaction: {
            select: {
              date: true,
              reference: true,
            },
          },
        },
      }),
      prisma.transaction.findMany({
        where: {
          userId,
          date: {
            gte: monthStart,
            lte: monthEnd,
          },
          splits: {
            none: {},
          },
        },
        select: {
          amount: true,
          reference: true,
        },
      }),
      prisma.transaction.findMany({
        where: { userId },
        include: {
          account: true,
          splits: {
            include: {
              category: true,
            },
          },
        },
        orderBy: [{ date: "desc" }, { createdAt: "desc" }],
        take: 10,
      }),
      prisma.transaction.groupBy({
        by: ["accountId"],
        where: {
          userId,
          date: {
            lt: trendStart,
          },
        },
        _sum: { amount: true },
      }),
      prisma.transaction.findMany({
        where: {
          userId,
          date: {
            gte: trendStart,
          },
        },
        orderBy: { date: "asc" },
        select: {
          accountId: true,
          amount: true,
          date: true,
        },
      }),
    ]);

  const totalsMap = new Map(
    transactionTotals.map((group) => [group.accountId, group._sum.amount ?? 0])
  );

  // Create a map of financial account ID to investment account for quick lookup
  const investmentAccountMap = new Map(
    investmentAccounts.map((inv) => [inv.accountId, inv])
  );

  const accountBalances = await Promise.all(
    accounts.map(async (account) => {
      const investmentAccount = investmentAccountMap.get(account.id);

      if (investmentAccount) {
        // For investment accounts, use the proper calculation including market values
        const accountBalance = await calculateInvestmentAccountBalance(
          investmentAccount.id,
          account.openingBalance,
          investmentAccount.trades.map(trade => ({
            type: trade.type,
            assetType: trade.assetType,
            symbol: trade.symbol,
            quantity: trade.quantity?.toString() ?? null,
            amount: trade.amount,
            fees: trade.fees,
          }))
        );

        // Convert from dollars to cents for consistent display
        const balance = Math.round(accountBalance.totalValue * 100);

        return {
          ...account,
          balance,
        };
      } else {
        // For regular accounts, use simple transaction sum
        const balance = account.openingBalance + (totalsMap.get(account.id) ?? 0);
        return {
          ...account,
          balance,
        };
      }
    })
  );

  const totalNetWorth = sumValues(accountBalances.map((account) => account.balance));

  const incomeSplits = monthlySplits.filter(
    (split) =>
      split.category.type === "INCOME" &&
      !(split.transaction.reference && split.transaction.reference.startsWith("transfer_")) &&
      !(split.transaction.reference && split.transaction.reference.startsWith("investment_"))
  );
  const expenseSplits = monthlySplits.filter(
    (split) =>
      split.category.type === "EXPENSE" &&
      !(split.transaction.reference && split.transaction.reference.startsWith("transfer_")) &&
      !(split.transaction.reference && split.transaction.reference.startsWith("investment_"))
  );

  const monthlyIncome = sumValues(incomeSplits.map((split) => split.amount));
  const monthlyExpenses = sumValues(expenseSplits.map((split) => Math.abs(split.amount)));
  const uncategorizedExpense = sumValues(
    uncategorizedTransactions
      .filter((tx) =>
        tx.amount < 0 &&
        !(tx.reference && tx.reference.startsWith("transfer_")) &&
        !(tx.reference && tx.reference.startsWith("investment_"))
      )
      .map((tx) => Math.abs(tx.amount))
  );
  const uncategorizedIncome = sumValues(
    uncategorizedTransactions
      .filter((tx) =>
        tx.amount > 0 &&
        !(tx.reference && tx.reference.startsWith("transfer_")) &&
        !(tx.reference && tx.reference.startsWith("investment_"))
      )
      .map((tx) => tx.amount)
  );

  const totalIncome = monthlyIncome + uncategorizedIncome;
  const totalExpenses = monthlyExpenses + uncategorizedExpense;

  const topCategories = expenseSplits.reduce<Record<string, { name: string; value: number }>>(
    (acc, split) => {
      const key = split.categoryId;
      const current = acc[key] ?? { name: split.category.name, value: 0 };
      current.value += Math.abs(split.amount);
      acc[key] = current;
      return acc;
    },
    {}
  );

  const topCategoriesList = Object.values(topCategories)
    .sort((a, b) => b.value - a.value)
    .slice(0, 5);

  const budgetCategories = await prisma.category.findMany({
    where: {
      userId,
      budgetLimit: {
        not: null,
      },
      type: "EXPENSE",
    },
  });

  const budgetProgress = budgetCategories
    .map((category) => {
      const spent = expenseSplits
        .filter((split) => split.categoryId === category.id)
        .reduce((total, split) => total + Math.abs(split.amount), 0);

      const limit = category.budgetLimit ?? 0;
      const percent = limit > 0 ? Math.min(100, Math.round((spent / limit) * 100)) : 0;
      return {
        id: category.id,
        name: category.name,
        spent,
        limit,
        percent,
      };
    })
    .sort((a, b) => {
      if (b.percent !== a.percent) {
        return b.percent - a.percent;
      }
      // tie-breaker: show higher absolute spend first
      return b.spent - a.spent;
    });

  const baseBalances = new Map(
    accounts.map((account) => [account.id, account.openingBalance])
  );

  for (const group of preRangeSums) {
    const current = baseBalances.get(group.accountId) ?? 0;
    baseBalances.set(group.accountId, current + (group._sum.amount ?? 0));
  }

  const months = Array.from({ length: trendMonths }).map((_, index) =>
    startOfMonth(addMonths(trendStart, index))
  );

  const labelFormat = trendMonths > 12 ? "MMM yy" : "MMM";

  // Get investment valuations for the trend period
  const investmentValuations = await prisma.investmentValuation.findMany({
    where: {
      userId,
      asOf: {
        gte: trendStart,
      }
    },
    include: {
      account: {
        include: {
          account: true
        }
      }
    },
    orderBy: { asOf: "asc" }
  });

  let cursor = 0;
  const trendData = months.map((month) => {
    const monthEndDate = endOfMonth(month);

    // Update traditional account balances based on transactions
    while (cursor < trendTransactions.length && trendTransactions[cursor].date <= monthEndDate) {
      const tx = trendTransactions[cursor];
      const current = baseBalances.get(tx.accountId) ?? 0;
      baseBalances.set(tx.accountId, current + tx.amount);
      cursor += 1;
    }

    // Calculate total from traditional accounts
    let total = 0;
    for (const account of accounts) {
      if (!investmentAccountMap.has(account.id)) {
        // Traditional account - use transaction-based balance
        total += baseBalances.get(account.id) ?? account.openingBalance;
      }
    }

    // Add investment account values for this month
    for (const account of accounts) {
      if (investmentAccountMap.has(account.id)) {
        // Find the most recent valuation up to month end
        const relevantValuations = investmentValuations.filter(
          val => val.account.accountId === account.id && val.asOf <= monthEndDate
        );

        if (relevantValuations.length > 0) {
          const latestValuation = relevantValuations[relevantValuations.length - 1];
          total += latestValuation.value; // Investment valuations are already in cents
        }
        // If no valuation data for this investment account, it contributes 0
      }
    }

    return {
      label: format(month, labelFormat),
      value: total,
    };
  });

  const averageNetCash = (() => {
    const monthsMap = new Map<string, { income: number; expense: number }>();
    for (const split of monthlySplits) {
      // Skip investment-related transactions in average calculation
      if (split.transaction.reference && split.transaction.reference.startsWith("investment_")) {
        continue;
      }
      const key = format(split.transaction.date, "yyyy-MM");
      const entry = monthsMap.get(key) ?? { income: 0, expense: 0 };
      if (split.category.type === "INCOME") {
        entry.income += split.amount;
      } else if (split.category.type === "EXPENSE") {
        entry.expense += Math.abs(split.amount);
      }
      monthsMap.set(key, entry);
    }
    const values = Array.from(monthsMap.values());
    if (values.length === 0) return 0;
    const totals = values.map((item) => item.income - item.expense);
    return Math.round(sumValues(totals) / values.length);
  })();

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle>Net Worth</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold text-[var(--card-foreground)]">{formatCurrency(totalNetWorth)}</p>
            <p className="mt-1 text-sm text-[var(--muted-foreground)]">
              Across {accountBalances.length} accounts
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Income (month)</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold text-[var(--card-foreground)]">{formatCurrency(totalIncome)}</p>
            <p className="mt-1 text-sm text-[var(--muted-foreground)]">
              Includes {formatCurrency(uncategorizedIncome)} uncategorized
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Expenses (month)</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold text-[var(--card-foreground)]">{formatCurrency(totalExpenses)}</p>
            <p className="mt-1 text-sm text-[var(--muted-foreground)]">
              Includes {formatCurrency(uncategorizedExpense)} uncategorized
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Cash Flow</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold text-[var(--card-foreground)]">{formatCurrency(totalIncome - totalExpenses)}</p>
            <p className="mt-1 text-sm text-[var(--muted-foreground)]">
              Avg. monthly net: {formatCurrency(averageNetCash)}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle>Net Worth Trend</CardTitle>
            <NetWorthRangeSelector />
          </CardHeader>
          <CardContent className="h-[280px]">
            <NetWorthChart data={trendData} currency={accounts[0]?.currency ?? "USD"} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Top Spending Categories</CardTitle>
          </CardHeader>
          <CardContent>
            <CategoryPieChart data={topCategoriesList} />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Budget Progress</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {budgetProgress.length === 0 && (
              <p className="text-sm text-[var(--muted-foreground)]">
                Set monthly budgets in the Categories tab to track progress.
              </p>
            )}
            {budgetProgress.filter(budget => budget.spent > 0).map((budget) => (
              <div key={budget.id} className="space-y-1">
                <div className="flex justify-between text-sm font-medium text-[var(--card-foreground)]">
                  <span>{budget.name}</span>
                  <span>
                    {formatCurrency(budget.spent)} / {formatCurrency(budget.limit ?? 0)}
                  </span>
                </div>
                <div className="h-2.5 w-full overflow-hidden rounded-full bg-[var(--secondary)]">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-[var(--primary)] via-[color:color-mix(in_srgb,var(--primary)_75%,#c7d2fe_25%)] to-[color:color-mix(in_srgb,var(--primary)_55%,#c7d2fe_45%)] transition-[width] duration-500"
                    style={{ width: `${budget.percent}%` }}
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Account Balances</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {accountBalances.map((account) => (
              <div key={account.id} className="flex items-center justify-between text-sm">
                <div>
                  <p className="font-medium text-[var(--card-foreground)]">{account.name}</p>
                  <p className="text-xs text-[var(--muted-foreground)]">{account.type}</p>
                </div>
                <p className="font-semibold text-[var(--card-foreground)]">
                  {formatCurrency(account.balance, account.currency)}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Recent Transactions</CardTitle>
          <Link
            href="/transactions"
            className="text-sm font-medium text-[var(--primary)] transition hover:brightness-110"
          >
            View all
          </Link>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHead>
              <TableRow>
                <TableHeaderCell>Date</TableHeaderCell>
                <TableHeaderCell>Description</TableHeaderCell>
                <TableHeaderCell>Account</TableHeaderCell>
                <TableHeaderCell>Category</TableHeaderCell>
                <TableHeaderCell className="text-right">Amount</TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {recentTransactions.map((transaction) => {
                const categoryName = transaction.splits[0]?.category?.name ?? "Uncategorized";
                return (
                  <TableRow key={transaction.id}>
                    <TableCell>{format(transaction.date, "MMM d, yyyy")}</TableCell>
                    <TableCell className="font-medium text-[var(--card-foreground)]">
                      {transaction.description}
                    </TableCell>
                    <TableCell>{transaction.account.name}</TableCell>
                    <TableCell>{categoryName}</TableCell>
                    <TableCell className="text-right font-semibold">
                      {formatCurrency(transaction.amount)}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
