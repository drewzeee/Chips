import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { transactionSchema } from "@/lib/validators";
import {
  findBestTransferCandidate,
  markTransactionsAsTransfer,
  applyCategorizationRules,
} from "./utils";
import { getAuthenticatedUser, unauthorizedResponse } from "@/lib/auth-helpers";

function buildFilters(params: URLSearchParams) {
  const accountId = params.get("accountId") ?? undefined;
  const status = params.get("status") ?? undefined;
  const search = params.get("search") ?? undefined;
  const categoryId = params.get("categoryId") ?? undefined;
  const from = params.get("from") ? new Date(params.get("from")!) : undefined;
  const to = params.get("to") ? new Date(params.get("to")!) : undefined;
  const uncategorized = params.get("uncategorized") === "true";

  return { accountId, status, search, categoryId, from, to, uncategorized };
}

export async function GET(request: Request) {
  const user = await getAuthenticatedUser();
  if (!user?.id) {
    return unauthorizedResponse();
  }

  const { searchParams } = new URL(request.url);
  const filters = buildFilters(searchParams);

  const transactions = await prisma.transaction.findMany({
    where: {
      userId: user.id,
      ...(filters.accountId ? { accountId: filters.accountId } : {}),
      ...(filters.status ? { status: filters.status as "PENDING" | "CLEARED" | "RECONCILED" } : {}),
      ...(filters.from || filters.to
        ? {
            date: {
              ...(filters.from ? { gte: filters.from } : {}),
              ...(filters.to ? { lte: filters.to } : {}),
            },
          }
        : {}),
      ...(filters.search
        ? {
            OR: [
              { description: { contains: filters.search, mode: "insensitive" } },
              { merchant: { contains: filters.search, mode: "insensitive" } },
            ],
          }
        : {}),
      ...(filters.uncategorized
        ? {
            splits: {
              none: {},
            },
          }
        : filters.categoryId
        ? {
            splits: {
              some: {
                categoryId: filters.categoryId,
              },
            },
          }
        : {}),
    },
    include: {
      account: true,
      splits: {
        include: {
          category: true,
        },
      },
    },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    take: Number(searchParams.get("limit") ?? 200),
  });

  return NextResponse.json(transactions);
}

export async function POST(request: Request) {
  const user = await getAuthenticatedUser();
  if (!user?.id) {
    return unauthorizedResponse();
  }

  const body = await request.json();
  const parsed = transactionSchema.omit({ id: true }).safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const account = await prisma.financialAccount.findUnique({
    where: { id: parsed.data.accountId },
  });

  if (!account || account.userId !== user.id) {
    return NextResponse.json({ error: "Invalid account" }, { status: 400 });
  }

  const splits = parsed.data.splits ?? [];

  if (splits.length > 0) {
    const sum = splits.reduce((total, split) => total + split.amount, 0);
    if (sum !== parsed.data.amount) {
      return NextResponse.json(
        { error: "Split amounts must equal the transaction amount" },
        { status: 400 }
      );
    }

    const categoryIds = [...new Set(splits.map((split) => split.categoryId))];
    const categories = await prisma.category.findMany({
      where: { id: { in: categoryIds } },
    });

    if (categories.length !== categoryIds.length || categories.some((c) => c.userId !== user.id)) {
      return NextResponse.json({ error: "Invalid category selection" }, { status: 400 });
    }
  }

  const transaction = await prisma.transaction.create({
    data: {
      userId: user.id,
      accountId: parsed.data.accountId,
      date: parsed.data.date,
      amount: parsed.data.amount,
      description: parsed.data.description,
      memo: parsed.data.memo ?? null,
      status: parsed.data.status,
      merchant: parsed.data.merchant ?? null,
      pending: parsed.data.status === "PENDING",
      reference: parsed.data.reference ?? null,
      importTag: parsed.data.importTag ?? null,
      splits:
        splits.length > 0
          ? {
              create: splits.map((split) => ({
                userId: user.id,
                categoryId: split.categoryId,
                amount: split.amount,
              })),
            }
          : undefined,
    },
    include: {
      account: true,
      splits: {
        include: { category: true },
      },
    },
  });

  let workingTransaction = transaction;

  if (transaction && transaction.account) {
    const match = await findBestTransferCandidate({
      userId: user.id,
      account: transaction.account,
      transaction,
      existingReference: transaction.reference,
    });

    if (match) {
      await markTransactionsAsTransfer({
        transactionA: transaction,
        transactionB: match.transaction,
      });

      const refreshed = await prisma.transaction.findUnique({
        where: { id: transaction.id },
        include: {
          account: true,
          splits: { include: { category: true } },
        },
      });

      if (refreshed) {
        workingTransaction = refreshed;
      }
    }
  }

  const categorized = await applyCategorizationRules({
    transactionId: workingTransaction.id,
    userId: user.id,
  });

  return NextResponse.json(categorized ?? workingTransaction, { status: 201 });
}

export async function DELETE(request: Request) {
  const user = await getAuthenticatedUser();
  if (!user?.id) {
    return unauthorizedResponse();
  }

  const { searchParams } = new URL(request.url);
  const importTag = searchParams.get("importTag");

  if (importTag) {
    const transactions = await prisma.transaction.findMany({
      where: { userId: user.id, importTag },
      select: { id: true },
    });

    if (transactions.length === 0) {
      return NextResponse.json({ deleted: 0, importTag });
    }

    const transactionIds = transactions.map((transaction) => transaction.id);

    await prisma.$transaction([
      prisma.transactionSplit.deleteMany({ where: { transactionId: { in: transactionIds }, userId: user.id } }),
      prisma.transaction.deleteMany({ where: { id: { in: transactionIds }, userId: user.id } }),
    ]);

    return NextResponse.json({ deleted: transactions.length, importTag });
  }

  await prisma.$transaction([
    prisma.transactionSplit.deleteMany({ where: { userId: user.id } }),
    prisma.transaction.deleteMany({ where: { userId: user.id } }),
  ]);

  return NextResponse.json({ success: true });
}
