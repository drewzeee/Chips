import type { Prisma } from "@/generated/prisma";

type TransactionRuleModel = Prisma.TransactionRuleGetPayload<Prisma.TransactionRuleDefaultArgs>;

type MinimalTransaction = {
  accountId: string;
  description: string;
  amount: number;
};

export function transactionMatchesRule({
  transaction,
  rule,
}: {
  transaction: MinimalTransaction;
  rule: TransactionRuleModel;
}) {
  if (rule.accountId && rule.accountId !== transaction.accountId) {
    return false;
  }

  const description = transaction.description.toLowerCase();

  if (rule.descriptionStartsWith) {
    const prefix = rule.descriptionStartsWith.toLowerCase();
    if (!description.startsWith(prefix)) {
      return false;
    }
  }

  if (rule.descriptionContains) {
    const fragment = rule.descriptionContains.toLowerCase();
    if (!description.includes(fragment)) {
      return false;
    }
  }

  if (rule.amountEquals != null) {
    const normalizedAmount = Math.abs(transaction.amount);
    if (normalizedAmount !== Math.abs(rule.amountEquals)) {
      return false;
    }
  }

  return true;
}

