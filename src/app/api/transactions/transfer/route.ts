import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedUser, unauthorizedResponse } from "@/lib/auth-helpers";
import { transferSchema } from "@/lib/validators";

export async function POST(request: Request) {
  const user = await getAuthenticatedUser();
  if (!user?.id) {
    return unauthorizedResponse();
  }

  const json = await request.json();
  const parsed = transferSchema.safeParse(json);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const { fromAccountId, toAccountId, date, amount, description, memo } = parsed.data;

  if (fromAccountId === toAccountId) {
    return NextResponse.json(
      { error: "Choose two different accounts for transfers" },
      { status: 400 }
    );
  }

  const accounts = await prisma.financialAccount.findMany({
    where: {
      id: { in: [fromAccountId, toAccountId] },
      userId: user.id,
    },
    select: {
      id: true,
      name: true,
      currency: true,
      investment: {
        select: {
          id: true,
        },
      },
    },
  });

  if (accounts.length !== 2) {
    return NextResponse.json({ error: "Invalid account selection" }, { status: 400 });
  }

  const fromAccount = accounts.find((account) => account.id === fromAccountId)!;
  const toAccount = accounts.find((account) => account.id === toAccountId)!;

  const transferReference = `transfer_${Date.now()}_${Math.random()
    .toString(36)
    .slice(2, 8)}`;

  const transferDate = new Date(date);

  const result = await prisma.$transaction(async (tx) => {
    const debit = await tx.transaction.create({
      data: {
        userId: user.id,
        accountId: fromAccountId,
        date: transferDate,
        amount: -Math.abs(amount),
        description: description || `Transfer to ${toAccount.name}`,
        memo: memo ?? null,
        status: "CLEARED",
        reference: transferReference,
        pending: false,
      },
      include: {
        account: true,
        splits: { include: { category: true } },
      },
    });

    const credit = await tx.transaction.create({
      data: {
        userId: user.id,
        accountId: toAccountId,
        date: transferDate,
        amount: Math.abs(amount),
        description: description || `Transfer from ${fromAccount.name}`,
        memo: memo ?? null,
        status: "CLEARED",
        reference: transferReference,
        pending: false,
      },
      include: {
        account: true,
        splits: { include: { category: true } },
      },
    });

    // Create investment transactions for investment accounts
    if (fromAccount.investment) {
      await tx.investmentTransaction.create({
        data: {
          userId: user.id,
          investmentAccountId: fromAccount.investment.id,
          type: "WITHDRAW",
          amount: -Math.abs(amount),
          occurredAt: transferDate,
          notes: memo || `Transfer to ${toAccount.name}`,
        },
      });
    }

    if (toAccount.investment) {
      await tx.investmentTransaction.create({
        data: {
          userId: user.id,
          investmentAccountId: toAccount.investment.id,
          type: "DEPOSIT",
          amount: Math.abs(amount),
          occurredAt: transferDate,
          notes: memo || `Transfer from ${fromAccount.name}`,
        },
      });
    }

    return { debit, credit };
  });

  return NextResponse.json(result, { status: 201 });
}
