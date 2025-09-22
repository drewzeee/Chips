import { prisma } from "@/lib/prisma";
import { getAuthSession } from "@/lib/auth";
import { AccountsClient, AccountWithBalance } from "@/components/accounts/accounts-client";
import { calculateInvestmentAccountBalance } from "@/lib/investment-calculations";

export default async function AccountsPage() {
  const session = await getAuthSession();
  const userId = session?.user?.id;

  if (!userId) {
    return null;
  }

  const [accounts, investmentAccounts, transactionGroups] = await Promise.all([
    prisma.financialAccount.findMany({
      where: { userId },
      orderBy: { createdAt: "asc" },
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
  ]);

  const totals = new Map(
    transactionGroups.map((item) => [item.accountId, item._sum.amount ?? 0])
  );

  // Create a map of financial account ID to investment account for quick lookup
  const investmentAccountMap = new Map(
    investmentAccounts.map((inv) => [inv.accountId, inv])
  );

  const payload: AccountWithBalance[] = await Promise.all(
    accounts.map(async (account) => {
      const investmentAccount = investmentAccountMap.get(account.id);

      let balance;

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
        balance = Math.round(accountBalance.totalValue * 100);
      } else {
        // For regular accounts, use simple transaction sum
        balance = account.openingBalance + (totals.get(account.id) ?? 0);
      }

      return {
        id: account.id,
        name: account.name,
        type: account.type,
        currency: account.currency,
        openingBalance: account.openingBalance,
        creditLimit: account.creditLimit ?? null,
        status: account.status,
        institution: account.institution,
        notes: account.notes,
        createdAt: account.createdAt.toISOString(),
        balance,
      };
    })
  );

  return <AccountsClient initialAccounts={payload} defaultCurrency={payload[0]?.currency ?? "USD"} />;
}
