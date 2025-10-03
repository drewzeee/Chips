import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { transactionSchema } from "@/lib/validators";
import { getAuthenticatedUser, unauthorizedResponse } from "@/lib/auth-helpers";
import {
  findBestTransferCandidate,
  markTransactionsAsTransfer,
  applyCategorizationRules,
} from "../utils";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const user = await getAuthenticatedUser();
  if (!user?.id) {
    return unauthorizedResponse();
  }

  const existing = await prisma.transaction.findUnique({
    where: { id },
    include: { splits: true },
  });

  if (!existing || existing.userId !== user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await request.json();
  const parsed = transactionSchema.safeParse({ ...body, id });

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const account = await prisma.financialAccount.findUnique({ where: { id: parsed.data.accountId } });
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
    const categories = await prisma.category.findMany({ where: { id: { in: categoryIds } } });
    if (categories.length !== categoryIds.length || categories.some((category) => category.userId !== user.id)) {
      return NextResponse.json({ error: "Invalid category selection" }, { status: 400 });
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.transaction.update({
      where: { id },
      data: {
        accountId: parsed.data.accountId,
        date: parsed.data.date,
        // Preserve originalDate - it should only be set on import and never changed
        amount: parsed.data.amount,
        description: parsed.data.description,
        memo: parsed.data.memo ?? null,
        status: parsed.data.status,
        merchant: parsed.data.merchant ?? null,
        pending: parsed.data.status === "PENDING",
        reference: parsed.data.reference ?? null,
        importTag: parsed.data.importTag ?? existing.importTag,
      },
    });

    await tx.transactionSplit.deleteMany({ where: { transactionId: id } });

    if (splits.length > 0) {
      await tx.transactionSplit.createMany({
        data: splits.map((split) => ({
          transactionId: id,
          categoryId: split.categoryId,
          amount: split.amount,
          userId: user.id,
        })),
      });
    }

  });

  let transactionWithRelations = await prisma.transaction.findUnique({
    where: { id },
    include: {
      account: true,
      splits: { include: { category: true } },
    },
  });

  if (transactionWithRelations) {
    const match = await findBestTransferCandidate({
      userId: user.id,
      account: transactionWithRelations.account,
      transaction: transactionWithRelations,
      existingReference: transactionWithRelations.reference,
    });

    if (match) {
      await markTransactionsAsTransfer({
        transactionA: transactionWithRelations,
        transactionB: match.transaction,
      });

      const refreshed = await prisma.transaction.findUnique({
        where: { id },
        include: {
          account: true,
          splits: { include: { category: true } },
        },
      });

      if (refreshed) {
        transactionWithRelations = refreshed;
      }
    }

    const categorized = await applyCategorizationRules({
      transactionId: transactionWithRelations.id,
      userId: user.id,
    });

    if (categorized) {
      transactionWithRelations = categorized;
    }
  }

  return NextResponse.json(transactionWithRelations);
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const user = await getAuthenticatedUser();
  if (!user?.id) {
    return unauthorizedResponse();
  }

  const existing = await prisma.transaction.findUnique({ where: { id } });
  if (!existing || existing.userId !== user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.$transaction(async (tx) => {
    // If this is an investment trade transaction, also delete the investment transaction record
    if (existing.reference?.startsWith("investment_trade_")) {
      const investmentTradeId = existing.reference.replace("investment_trade_", "");
      await tx.investmentTransaction.deleteMany({
        where: {
          id: investmentTradeId,
          userId: user.id,
        },
      });
    }

    // If this is a valuation adjustment transaction, also delete the corresponding valuation
    if (existing.reference?.startsWith("investment_valuation_")) {
      const valuationId = existing.reference.replace("investment_valuation_", "");
      await tx.investmentValuation.deleteMany({
        where: {
          id: valuationId,
          userId: user.id,
        },
      });
    }

    await tx.transaction.delete({ where: { id } });
  });

  return NextResponse.json({ success: true });
}
