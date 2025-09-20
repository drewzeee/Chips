import { prisma } from "@/lib/prisma";
import { startOfDay } from "date-fns";

export interface ExternalBalance {
  source: string;
  currency: string;
  amount: number;
  usdValue: number;
}

export async function saveExternalBalanceSnapshots(
  userId: string,
  balances: ExternalBalance[],
  asOf: Date = new Date()
): Promise<void> {
  const dayStart = startOfDay(asOf);

  // Upsert snapshots for each balance
  for (const balance of balances) {
    await prisma.externalBalanceSnapshot.upsert({
      where: {
        userId_source_currency_asOf: {
          userId,
          source: balance.source,
          currency: balance.currency,
          asOf: dayStart,
        },
      },
      update: {
        amount: balance.amount,
        usdValue: balance.usdValue,
      },
      create: {
        userId,
        source: balance.source,
        currency: balance.currency,
        amount: balance.amount,
        usdValue: balance.usdValue,
        asOf: dayStart,
      },
    });
  }
}

export async function getExternalBalanceHistory(
  userId: string,
  days: number = 30
): Promise<Array<{
  date: Date;
  totalUSDValue: number;
  balances: Array<{
    source: string;
    currency: string;
    amount: number;
    usdValue: number;
  }>;
}>> {
  const endDate = startOfDay(new Date());
  const startDate = new Date(endDate);
  startDate.setDate(startDate.getDate() - days);

  const snapshots = await prisma.externalBalanceSnapshot.findMany({
    where: {
      userId,
      asOf: {
        gte: startDate,
        lte: endDate,
      },
    },
    orderBy: {
      asOf: "asc",
    },
  });

  // Group by date
  const groupedByDate = snapshots.reduce((acc, snapshot) => {
    const dateKey = snapshot.asOf.toISOString().split('T')[0];
    if (!acc[dateKey]) {
      acc[dateKey] = [];
    }
    acc[dateKey].push({
      source: snapshot.source,
      currency: snapshot.currency,
      amount: Number(snapshot.amount),
      usdValue: Number(snapshot.usdValue),
    });
    return acc;
  }, {} as Record<string, any[]>);

  // Convert to array format
  return Object.entries(groupedByDate).map(([dateStr, balances]) => ({
    date: new Date(dateStr),
    totalUSDValue: balances.reduce((sum, b) => sum + b.usdValue, 0),
    balances,
  }));
}

export async function getTotalExternalBalanceUSD(userId: string): Promise<number> {
  const today = startOfDay(new Date());

  const snapshots = await prisma.externalBalanceSnapshot.findMany({
    where: {
      userId,
      asOf: today,
    },
  });

  return snapshots.reduce((sum, snapshot) => sum + Number(snapshot.usdValue), 0);
}

export async function getTotalExternalBalanceUSDBySource(userId: string): Promise<Record<string, number>> {
  const today = startOfDay(new Date());

  const snapshots = await prisma.externalBalanceSnapshot.findMany({
    where: {
      userId,
      asOf: today,
    },
  });

  const balancesBySource: Record<string, number> = {};

  for (const snapshot of snapshots) {
    const source = snapshot.source;
    balancesBySource[source] = (balancesBySource[source] || 0) + Number(snapshot.usdValue);
  }

  return balancesBySource;
}