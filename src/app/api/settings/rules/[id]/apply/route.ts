import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedUser, unauthorizedResponse } from "@/lib/auth-helpers";
import { transactionMatchesRule } from "@/lib/rules";
import type { Prisma } from "@/generated/prisma";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const user = await getAuthenticatedUser();
  if (!user?.id) {
    return unauthorizedResponse();
  }

  const rule = await prisma.transactionRule.findUnique({
    where: { id },
  });

  if (!rule || rule.userId !== user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const filters: Prisma.TransactionWhereInput = {
    userId: user.id,
    NOT: {
      reference: {
        startsWith: "transfer_",
      },
    },
  };

  if (rule.accountId) {
    filters.accountId = rule.accountId;
  }

  if (rule.amountEquals != null) {
    filters.amount = {
      in: [rule.amountEquals, -rule.amountEquals],
    };
  }

  const transactions = await prisma.transaction.findMany({
    where: filters,
    select: {
      id: true,
      amount: true,
      accountId: true,
      description: true,
      splits: {
        select: {
          id: true,
          categoryId: true,
        },
      },
    },
  });

  if (transactions.length === 0) {
    return NextResponse.json({ updated: 0, skipped: 0, transactionIds: [], skippedTransactionIds: [] });
  }

  const actionable = [];
  const skipped = [];

  for (const transaction of transactions) {
    const matches = transactionMatchesRule({
      transaction,
      rule,
    });

    if (!matches) {
      continue;
    }

    if (transaction.splits.length > 1) {
      skipped.push(transaction.id);
      continue;
    }

    if (
      transaction.splits.length === 1 &&
      transaction.splits[0]?.categoryId === rule.categoryId
    ) {
      skipped.push(transaction.id);
      continue;
    }

    actionable.push(transaction);
  }

  if (actionable.length === 0) {
    return NextResponse.json({ updated: 0, skipped: skipped.length, transactionIds: [], skippedTransactionIds: skipped });
  }

  const updatedIds: string[] = [];

  await prisma.$transaction(async (tx) => {
    for (const transaction of actionable) {
      await tx.transaction.update({
        where: { id: transaction.id },
        data: {
          splits: {
            deleteMany: {},
            create: [
              {
                userId: user.id,
                categoryId: rule.categoryId,
                amount: transaction.amount,
              },
            ],
          },
        },
      });

      updatedIds.push(transaction.id);
    }
  });

  return NextResponse.json({
    updated: updatedIds.length,
    skipped: skipped.length,
    transactionIds: updatedIds,
    skippedTransactionIds: skipped,
  });
}
