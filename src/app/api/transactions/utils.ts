import { addDays } from "date-fns";
import { prisma } from "@/lib/prisma";
import { centsAreClose } from "@/lib/utils";
import type { Transaction, FinancialAccount } from "@/lib/types";
import { transactionMatchesRule } from "@/lib/rules";

interface CreateTransferCandidateParams {
  userId: string;
  account: FinancialAccount;
  transaction: Transaction;
  existingReference?: string | null;
}

const MATCH_WINDOW_DAYS = 3;
const AMOUNT_TOLERANCE = 100; // cents ($1 tolerance)

const likelyTransferKeywords = [
  "payment",
  "pmt",
  "transfer",
  "online payment",
  "mobile payment",
  "card services",
];

const accountTypePreference: Record<string, number> = {
  CREDIT_CARD: 2,
  CHECKING: 1,
  SAVINGS: 1,
  CASH: 0,
  INVESTMENT: 0,
};

function descriptionLooksLikeTransfer(description: string) {
  const normalized = description.toLowerCase();
  return likelyTransferKeywords.some((keyword) => normalized.includes(keyword));
}

function isOppositeSign(a: number, b: number) {
  return (a >= 0 && b <= 0) || (a <= 0 && b >= 0);
}

export interface TransferCandidate {
  transaction: Transaction;
  account: FinancialAccount;
  confidence: number;
}

export async function findTransferCandidates(
  { userId, account, transaction, existingReference }: CreateTransferCandidateParams,
  limit = 5
): Promise<TransferCandidate[]> {
  if (account.type === "CASH") {
    return [];
  }

  const amount = transaction.amount;
  if (amount === 0) {
    return [];
  }

  if (existingReference && existingReference.startsWith("transfer_")) {
    return [];
  }

  const windowStart = addDays(transaction.date, -MATCH_WINDOW_DAYS);
  const windowEnd = addDays(transaction.date, MATCH_WINDOW_DAYS);

  const candidates = await prisma.transaction.findMany({
    where: {
      userId,
      id: { not: transaction.id },
      account: {
        id: { not: account.id },
      },
      date: {
        gte: windowStart,
        lte: windowEnd,
      },
      pending: false,
    },
    include: {
      account: true,
    },
  });

  const ranked: TransferCandidate[] = [];

  for (const candidate of candidates) {
    if (!isOppositeSign(amount, candidate.amount)) continue;
    if (!centsAreClose(Math.abs(amount), Math.abs(candidate.amount), AMOUNT_TOLERANCE)) continue;

    const sameCurrency = candidate.account.currency === account.currency;
    if (!sameCurrency) continue;

    const preferredTypeScore = accountTypePreference[candidate.account.type] ?? 0;
    const descriptionScore = descriptionLooksLikeTransfer(candidate.description) ? 1 : 0;
    const sameDay = candidate.date.toDateString() === transaction.date.toDateString() ? 1 : 0;

    const confidence = preferredTypeScore * 2 + descriptionScore + sameDay;

    ranked.push({
      transaction: candidate as Transaction,
      account: candidate.account as FinancialAccount,
      confidence,
    });
  }

  ranked.sort((a, b) => b.confidence - a.confidence);

  const filtered = ranked.filter((item) => item.confidence >= 2);

  return filtered.slice(0, limit);
}

export async function markTransactionsAsTransfer({
  transactionA,
  transactionB,
}: {
  transactionA: Transaction;
  transactionB: Transaction;
}) {
  const reference = `transfer_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  await prisma.$transaction(async (tx) => {
    await tx.transaction.update({
      where: { id: transactionA.id },
      data: {
        reference,
        description:
          transactionA.description || `Transfer to ${transactionB.account?.name ?? "other account"}`,
        pending: false,
        status: "CLEARED",
        splits: {
          deleteMany: {},
        },
      },
    });

    await tx.transaction.update({
      where: { id: transactionB.id },
      data: {
        reference,
        description:
          transactionB.description || `Transfer from ${transactionA.account?.name ?? "other account"}`,
        pending: false,
        status: "CLEARED",
        splits: {
          deleteMany: {},
        },
      },
    });
  });
}

export async function findBestTransferCandidate(params: CreateTransferCandidateParams) {
  const [first] = await findTransferCandidates(params, 1);
  return first ?? null;
}

export async function applyCategorizationRules({
  transactionId,
  userId,
}: {
  transactionId: string;
  userId: string;
}) {
  const transaction = await prisma.transaction.findUnique({
    where: { id: transactionId },
    include: {
      account: true,
      splits: { include: { category: true } },
    },
  });

  if (!transaction || transaction.userId !== userId) {
    return null;
  }

  if (transaction.reference?.startsWith("transfer_")) {
    return transaction;
  }

  if (transaction.splits.length > 0) {
    return transaction;
  }

  const rules = await prisma.transactionRule.findMany({
    where: { userId },
    orderBy: { priority: "asc" },
  });

  if (rules.length === 0) {
    return transaction;
  }

  for (const rule of rules) {
    const matches = transactionMatchesRule({
      transaction: {
        accountId: transaction.accountId,
        description: transaction.description,
        amount: transaction.amount,
      },
      rule,
    });

    if (!matches) {
      continue;
    }

    const updated = await prisma.transaction.update({
      where: { id: transaction.id },
      data: {
        splits: {
          deleteMany: {},
          create: [
            {
              userId,
              categoryId: rule.categoryId,
              amount: transaction.amount,
            },
          ],
        },
      },
      include: {
        account: true,
        splits: { include: { category: true } },
      },
    });

    return updated;
  }

  return transaction;
}
