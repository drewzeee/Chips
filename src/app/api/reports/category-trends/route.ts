import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedUser, unauthorizedResponse } from "@/lib/auth-helpers";
import { format, startOfMonth, endOfMonth, eachMonthOfInterval, parseISO } from "date-fns";

type TransactionWithSplits = {
  date: Date;
  amount: number;
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

export async function GET(request: Request) {
  const user = await getAuthenticatedUser();
  if (!user?.id) {
    return unauthorizedResponse();
  }

  const { searchParams } = new URL(request.url);
  const fromParam = searchParams.get("from");
  const toParam = searchParams.get("to");

  if (!fromParam || !toParam) {
    return NextResponse.json(
      { error: "Both 'from' and 'to' date parameters are required" },
      { status: 400 }
    );
  }

  let fromDate: Date;
  let toDate: Date;

  try {
    fromDate = parseISO(fromParam);
    toDate = parseISO(toParam);
  } catch {
    return NextResponse.json(
      { error: "Invalid date format. Use YYYY-MM-DD format." },
      { status: 400 }
    );
  }

  const rangeStart = startOfMonth(fromDate);
  const rangeEnd = endOfMonth(toDate);

  // Generate monthly timeline
  const monthTimeline = eachMonthOfInterval({ start: rangeStart, end: rangeEnd }).map((date) => ({
    key: format(date, "yyyy-MM"),
    label: format(date, "MMM yyyy"),
  }));

  // Fetch transactions for the date range
  const transactions = await prisma.transaction.findMany({
    where: {
      userId: user.id,
      date: {
        gte: rangeStart,
        lte: rangeEnd,
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
  });

  // Build category trend data
  const categoryTrendMap = new Map<
    string,
    {
      id: string;
      name: string;
      type: "INCOME" | "EXPENSE";
      monthly: Map<string, number>;
      total: number;
    }
  >();

  function recordCategoryTrend(
    id: string | null,
    name: string | null,
    type: "INCOME" | "EXPENSE",
    monthKey: string,
    amount: number
  ) {
    const resolvedId = id ?? `${type}-uncategorized`;
    const resolvedName =
      name ?? (type === "EXPENSE" ? "Uncategorized (Expense)" : "Uncategorized (Income)");
    const key = `${type}:${resolvedId}`;
    const entry =
      categoryTrendMap.get(key) ?? {
        id: resolvedId,
        name: resolvedName,
        type,
        monthly: new Map<string, number>(),
        total: 0,
      };

    entry.total += amount;
    entry.monthly.set(monthKey, (entry.monthly.get(monthKey) ?? 0) + amount);
    categoryTrendMap.set(key, entry);
  }

  for (const transaction of transactions as TransactionWithSplits[]) {
    // Skip transfer and investment transactions
    if (transaction.reference &&
        (transaction.reference.startsWith("transfer_") ||
         transaction.reference.startsWith("investment_"))) {
      continue;
    }

    const monthKey = format(transaction.date, "yyyy-MM");

    if (transaction.splits.length > 0) {
      for (const split of transaction.splits) {
        if (split.category?.type === "EXPENSE") {
          recordCategoryTrend(
            split.category?.id ?? null,
            split.category?.name ?? null,
            "EXPENSE",
            monthKey,
            Math.abs(split.amount)
          );
        } else if (split.category?.type === "INCOME") {
          recordCategoryTrend(
            split.category?.id ?? null,
            split.category?.name ?? null,
            "INCOME",
            monthKey,
            Math.abs(split.amount)
          );
        }
      }
    } else {
      // Uncategorized transaction
      if (transaction.amount < 0) {
        recordCategoryTrend(
          null,
          null,
          "EXPENSE",
          monthKey,
          Math.abs(transaction.amount)
        );
      } else {
        recordCategoryTrend(
          null,
          null,
          "INCOME",
          monthKey,
          Math.abs(transaction.amount)
        );
      }
    }
  }

  // Convert to series format
  const categoryTrendSeries = Array.from(categoryTrendMap.values())
    .map((entry) => ({
      id: entry.id,
      name: entry.name,
      type: entry.type,
      total: entry.total,
      data: monthTimeline.map(({ key }) => ({
        month: key,
        value: entry.monthly.get(key) ?? 0,
      })),
    }))
    .filter((entry) => entry.total > 0);

  return NextResponse.json({
    months: monthTimeline,
    series: categoryTrendSeries,
  });
}