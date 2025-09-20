import { prisma } from "@/lib/prisma";
import { getAuthSession } from "@/lib/auth";
import { InvestmentsClient, type InvestmentAccountDetail } from "@/components/investments/investments-client";

export default async function InvestmentsPage() {
  const session = await getAuthSession();
  const userId = session?.user?.id;

  if (!userId) {
    return null;
  }

  const [investmentAccounts, transactionGroups, valuations, trades, assets] = await Promise.all([
    prisma.investmentAccount.findMany({
      where: { userId },
      include: {
        account: true,
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.transaction.groupBy({
      by: ["accountId"],
      where: {
        userId,
        account: {
          type: "INVESTMENT",
        },
      },
      _sum: { amount: true },
    }),
    prisma.investmentValuation.findMany({
      where: { userId },
      orderBy: { asOf: "desc" },
    }),
    prisma.investmentTransaction.findMany({
      where: { userId },
      orderBy: { occurredAt: "desc" },
    }),
    prisma.investmentAsset.findMany({
      where: { userId },
      include: {
        valuations: {
          orderBy: { asOf: "desc" },
          take: 30,
        },
      },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const totalsMap = new Map(
    transactionGroups.map((group) => [group.accountId, group._sum.amount ?? 0])
  );

  const valuationsMap = new Map<string, InvestmentAccountDetail["valuations"]>();
  for (const valuation of valuations) {
    const list = valuationsMap.get(valuation.investmentAccountId) ?? [];
    if (list.length >= 24) {
      continue;
    }
    list.push({
      id: valuation.id,
      value: valuation.value,
      asOf: valuation.asOf.toISOString(),
      createdAt: valuation.createdAt.toISOString(),
    });
    valuationsMap.set(valuation.investmentAccountId, list);
  }

  const tradesMap = new Map<string, InvestmentAccountDetail["trades"]>();
  for (const trade of trades) {
    const list = tradesMap.get(trade.investmentAccountId) ?? [];
    if (list.length >= 25) {
      continue;
    }
    list.push({
      id: trade.id,
      type: trade.type,
      assetType: trade.assetType,
      symbol: trade.symbol,
      quantity: trade.quantity ? trade.quantity.toString() : null,
      pricePerUnit: trade.pricePerUnit ? trade.pricePerUnit.toString() : null,
      amount: trade.amount,
      fees: trade.fees ?? null,
      occurredAt: trade.occurredAt.toISOString(),
      notes: trade.notes,
    });
    tradesMap.set(trade.investmentAccountId, list);
  }

  const payload: InvestmentAccountDetail[] = investmentAccounts.map((investment) => {
    const account = investment.account;
    const balance = account.openingBalance + (totalsMap.get(account.id) ?? 0);
    const assetList = assets
      .filter((asset) => asset.investmentAccountId === investment.id)
      .map((asset) => ({
        id: asset.id,
        name: asset.name,
        symbol: asset.symbol,
        type: asset.type,
        createdAt: asset.createdAt.toISOString(),
        valuations: asset.valuations.map((valuation) => ({
          id: valuation.id,
          value: valuation.value,
          quantity: valuation.quantity?.toString() ?? null,
          asOf: valuation.asOf.toISOString(),
          createdAt: valuation.createdAt.toISOString(),
        })),
      }));
    return {
      investmentAccountId: investment.id,
      accountId: account.id,
      name: account.name,
      currency: account.currency,
      status: account.status,
      assetClass: investment.assetClass,
      kind: investment.kind,
      openingBalance: account.openingBalance,
      balance,
      institution: account.institution,
      notes: account.notes,
      createdAt: account.createdAt.toISOString(),
      valuations: valuationsMap.get(investment.id) ?? [],
      trades: tradesMap.get(investment.id) ?? [],
      assets: assetList,
    };
  });

  return (
    <InvestmentsClient
      initialAccounts={payload}
      defaultCurrency={payload[0]?.currency ?? "USD"}
    />
  );
}
