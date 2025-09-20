import { prisma } from "@/lib/prisma";
import { getAuthSession } from "@/lib/auth";
import { AccountsClient, AccountWithBalance } from "@/components/accounts/accounts-client";

export default async function AccountsPage() {
  const session = await getAuthSession();
  const userId = session?.user?.id;

  if (!userId) {
    return null;
  }

  const [accounts, transactionGroups, snapshots] = await Promise.all([
    prisma.financialAccount.findMany({
      where: { userId },
      orderBy: { createdAt: "asc" },
    }),
    prisma.transaction.groupBy({
      by: ["accountId"],
      where: { userId },
      _sum: { amount: true },
    }),
    prisma.accountBalanceSnapshot.findMany({
      where: { userId },
      orderBy: { asOf: "asc" },
    }),
  ]);

  const totals = new Map(
    transactionGroups.map((item) => [item.accountId, item._sum.amount ?? 0])
  );

  const historyMap = new Map<string, typeof snapshots>();
  for (const snapshot of snapshots) {
    if (!historyMap.has(snapshot.accountId)) {
      historyMap.set(snapshot.accountId, []);
    }
    historyMap.get(snapshot.accountId)!.push(snapshot);
  }

  const payload: AccountWithBalance[] = accounts.map((account) => ({
    id: account.id,
    name: account.name,
    type: account.type,
    currency: account.currency,
    openingBalance: account.openingBalance,
    creditLimit: account.creditLimit ?? null,
    status: account.status,
    institution: account.institution,
    externalAccountId: account.externalAccountId,
    notes: account.notes,
    createdAt: account.createdAt.toISOString(),
    balance: account.openingBalance + (totals.get(account.id) ?? 0),
    history: (historyMap.get(account.id) ?? []).map((snapshot) => ({
      asOf: snapshot.asOf.toISOString(),
      balance: snapshot.balance,
      source: snapshot.source ?? null,
    })),
  }));

  return <AccountsClient initialAccounts={payload} defaultCurrency={payload[0]?.currency ?? "USD"} />;
}
