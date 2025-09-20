import { prisma } from "@/lib/prisma";
import { getAuthSession } from "@/lib/auth";
import { AccountsClient, AccountWithBalance } from "@/components/accounts/accounts-client";

export default async function AccountsPage() {
  const session = await getAuthSession();
  const userId = session?.user?.id;

  if (!userId) {
    return null;
  }

  const [accounts, transactionGroups] = await Promise.all([
    prisma.financialAccount.findMany({
      where: { userId },
      orderBy: { createdAt: "asc" },
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

  const payload: AccountWithBalance[] = accounts.map((account) => ({
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
    balance: account.openingBalance + (totals.get(account.id) ?? 0),
  }));

  return <AccountsClient initialAccounts={payload} defaultCurrency={payload[0]?.currency ?? "USD"} />;
}
