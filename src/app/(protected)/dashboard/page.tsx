import { endOfMonth, format, startOfMonth, subMonths } from "date-fns";
import { prisma } from "@/lib/prisma";
import { formatCurrency } from "@/lib/utils";
import { NetWorthChart } from "@/components/dashboard/net-worth-chart";
import { CategoryPieChart } from "@/components/dashboard/category-pie-chart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from "@/components/ui/table";
import { getAuthSession } from "@/lib/auth";
import Link from "next/link";

function sumValues(values: number[]) {
  return values.reduce((total, value) => total + value, 0);
}

export default async function DashboardPage() {
  const session = await getAuthSession();
  const userId = session?.user?.id;

  if (!userId) {
    return null;
  }

  const now = new Date();
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);
  const trendStart = startOfMonth(subMonths(now, 5));

  const [accounts, transactionTotals, monthlySplits, uncategorizedTransactions, recentTransactions, preRangeSums, trendTransactions] =
    await Promise.all([
      prisma.financialAccount.findMany({
        where: { userId },
        orderBy: { name: "asc" },
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

  const accountBalances = accounts.map((account) => {
    const balance = account.openingBalance + (totalsMap.get(account.id) ?? 0);
    return {
      ...account,
      balance,
    };
  });

  const totalNetWorth = sumValues(accountBalances.map((account) => account.balance));

  const incomeSplits = monthlySplits.filter(
    (split) =>
      split.category.type === "INCOME" &&
      !(split.transaction.reference && split.transaction.reference.startsWith("transfer_"))
  );
  const expenseSplits = monthlySplits.filter(
    (split) =>
      split.category.type === "EXPENSE" &&
      !(split.transaction.reference && split.transaction.reference.startsWith("transfer_"))
  );

  const monthlyIncome = sumValues(incomeSplits.map((split) => split.amount));
  const monthlyExpenses = sumValues(expenseSplits.map((split) => Math.abs(split.amount)));
  const uncategorizedExpense = sumValues(
    uncategorizedTransactions
      .filter((tx) =>
        tx.amount < 0 && !(tx.reference && tx.reference.startsWith("transfer_"))
      )
      .map((tx) => Math.abs(tx.amount))
  );
  const uncategorizedIncome = sumValues(
    uncategorizedTransactions
      .filter((tx) =>
        tx.amount > 0 && !(tx.reference && tx.reference.startsWith("transfer_"))
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

  const budgetProgress = budgetCategories.map((category) => {
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
  });

  const baseBalances = new Map(
    accounts.map((account) => [account.id, account.openingBalance])
  );

  for (const group of preRangeSums) {
    const current = baseBalances.get(group.accountId) ?? 0;
    baseBalances.set(group.accountId, current + (group._sum.amount ?? 0));
  }

  const months = Array.from({ length: 6 }).map((_, index) => {
    const monthDate = startOfMonth(subMonths(now, 5 - index));
    return monthDate;
  });

  let cursor = 0;
  const trendData = months.map((month) => {
    const monthEndDate = endOfMonth(month);
    while (cursor < trendTransactions.length && trendTransactions[cursor].date <= monthEndDate) {
      const tx = trendTransactions[cursor];
      const current = baseBalances.get(tx.accountId) ?? 0;
      baseBalances.set(tx.accountId, current + tx.amount);
      cursor += 1;
    }

    const total = Array.from(baseBalances.values()).reduce((total, value) => total + value, 0);
    return {
      label: format(month, "MMM"),
      value: total,
    };
  });

  const averageNetCash = (() => {
    const monthsMap = new Map<string, { income: number; expense: number }>();
    for (const split of monthlySplits) {
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
            <p className="text-3xl font-semibold">{formatCurrency(totalNetWorth)}</p>
            <p className="mt-1 text-sm text-gray-500">
              Across {accountBalances.length} accounts
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Income (month)</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold">{formatCurrency(totalIncome)}</p>
            <p className="mt-1 text-sm text-gray-500">
              Includes {formatCurrency(uncategorizedIncome)} uncategorized
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Expenses (month)</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold">{formatCurrency(totalExpenses)}</p>
            <p className="mt-1 text-sm text-gray-500">
              Includes {formatCurrency(uncategorizedExpense)} uncategorized
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Cash Flow</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold">{formatCurrency(totalIncome - totalExpenses)}</p>
            <p className="mt-1 text-sm text-gray-500">
              Avg. monthly net: {formatCurrency(averageNetCash)}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Net Worth Trend</CardTitle>
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
              <p className="text-sm text-gray-500">
                Set monthly budgets in the Categories tab to track progress.
              </p>
            )}
            {budgetProgress.slice(0, 5).map((budget) => (
              <div key={budget.id} className="space-y-1">
                <div className="flex justify-between text-sm font-medium text-gray-700">
                  <span>{budget.name}</span>
                  <span>
                    {formatCurrency(budget.spent)} / {formatCurrency(budget.limit ?? 0)}
                  </span>
                </div>
                <div className="h-2 rounded-full bg-gray-200">
                  <div
                    className="h-2 rounded-full bg-blue-600"
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
                  <p className="font-medium text-gray-800">{account.name}</p>
                  <p className="text-xs text-gray-500">{account.type}</p>
                </div>
                <p className="font-semibold text-gray-900">
                  {formatCurrency(account.balance, account.currency)}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex items-center justify-between">
          <CardTitle>Recent Transactions</CardTitle>
          <Link href="/transactions" className="text-sm text-blue-600 hover:underline">
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
                    <TableCell className="font-medium text-gray-800">
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
