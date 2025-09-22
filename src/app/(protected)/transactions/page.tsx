import { prisma } from "@/lib/prisma";
import { getAuthSession } from "@/lib/auth";
import { TransactionsClient, TransactionAccount, TransactionCategory, TransactionItem } from "@/components/transactions/transactions-client";

export default async function TransactionsPage() {
  const session = await getAuthSession();
  const userId = session?.user?.id;

  if (!userId) {
    return null;
  }

  const [transactions, accounts, categories] = await Promise.all([
    prisma.transaction.findMany({
      where: { userId },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      include: {
        account: true,
        splits: {
          include: {
            category: true,
          },
        },
      },
      take: 100,
    }),
    prisma.financialAccount.findMany({
      where: { userId },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        currency: true,
      },
    }),
    prisma.category.findMany({
      where: { userId },
      orderBy: [{ type: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        type: true,
      },
    }),
  ]);

  const transactionsPayload: TransactionItem[] = transactions.map((transaction) => ({
    id: transaction.id,
    date: transaction.date.toISOString(),
    description: transaction.description,
    merchant: transaction.merchant,
    amount: transaction.amount,
    status: transaction.status,
    accountId: transaction.accountId,
    reference: transaction.reference,
    account: {
      id: transaction.account.id,
      name: transaction.account.name,
      currency: transaction.account.currency,
    },
    memo: transaction.memo,
    importTag: transaction.importTag,
    splits: transaction.splits.map((split) => ({
      id: split.id,
      categoryId: split.categoryId,
      amount: split.amount,
      category: split.category
        ? {
            id: split.category.id,
            name: split.category.name,
            type: split.category.type,
          }
        : undefined,
    })),
  }));

  const accountsPayload: TransactionAccount[] = accounts.map((account) => ({
    id: account.id,
    name: account.name,
    currency: account.currency,
  }));

  const categoriesPayload: TransactionCategory[] = categories.map((category) => ({
    id: category.id,
    name: category.name,
    type: category.type,
  }));

  return (
    <TransactionsClient
      initialTransactions={transactionsPayload}
      accounts={accountsPayload}
      categories={categoriesPayload}
    />
  );
}
