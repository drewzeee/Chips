import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedUser, unauthorizedResponse } from "@/lib/auth-helpers";
import { transactionMatchesRule } from "@/lib/rules";
import type { Prisma } from "@/generated/prisma";

const PREVIEW_LIMIT = 50;

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
    include: {
      category: true,
    },
  });

  if (!rule || rule.userId !== user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const filters: Prisma.TransactionWhereInput = {
    userId: user.id,
    OR: [
      {
        reference: null,
      },
      {
        NOT: {
          reference: {
            startsWith: "transfer_",
          },
        },
      },
    ],
  };

  if (rule.accountId) {
    filters.accountId = rule.accountId;
  }

  if (rule.amountEquals != null) {
    filters.amount = {
      in: [rule.amountEquals, -rule.amountEquals],
    };
  }

  const candidates = await prisma.transaction.findMany({
    where: filters,
    include: {
      account: {
        select: {
          id: true,
          name: true,
          currency: true,
        },
      },
      splits: {
        select: {
          id: true,
          categoryId: true,
        },
      },
    },
    orderBy: { date: "desc" },
  });

  const matches = candidates.filter((transaction) =>
    transactionMatchesRule({
      transaction: {
        accountId: transaction.accountId,
        description: transaction.description,
        amount: transaction.amount,
      },
      rule,
    })
  );

  const actionable = matches.filter((transaction) => {
    if (transaction.splits.length === 0) {
      return true;
    }

    if (transaction.splits.length > 1) {
      return false;
    }

    return transaction.splits[0]?.categoryId !== rule.categoryId;
  });

  const limited = actionable.slice(0, PREVIEW_LIMIT);

  return NextResponse.json({
    count: actionable.length,
    limit: PREVIEW_LIMIT,
    transactions: limited.map((transaction) => ({
      id: transaction.id,
      date: transaction.date,
      description: transaction.description,
      amount: transaction.amount,
      account: transaction.account,
      existingSplitCount: transaction.splits.length,
    })),
  });
}
