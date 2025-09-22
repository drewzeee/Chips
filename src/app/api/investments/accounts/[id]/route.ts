import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  getAuthenticatedUser,
  unauthorizedResponse,
} from "@/lib/auth-helpers";
import { investmentAccountSchema } from "@/lib/validators";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const user = await getAuthenticatedUser();
  if (!user?.id) {
    return unauthorizedResponse();
  }

  const existing = await prisma.investmentAccount.findUnique({
    where: { id },
    include: {
      account: true,
    },
  });

  if (!existing || existing.userId !== user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await request.json();
  const parsed = investmentAccountSchema.safeParse({
    ...body,
    id: existing.accountId,
    type: "INVESTMENT",
  });

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const updated = await prisma.$transaction(async (tx) => {
    const account = await tx.financialAccount.update({
      where: { id: existing.accountId },
      data: {
        name: parsed.data.name,
        currency: parsed.data.currency.toUpperCase(),
        openingBalance: parsed.data.openingBalance,
        creditLimit: parsed.data.creditLimit ?? null,
        status: parsed.data.status,
        institution: parsed.data.institution ?? null,
        notes: parsed.data.notes ?? null,
      },
    });

    const investmentAccount = await tx.investmentAccount.update({
      where: { id },
      data: {
        assetClass: parsed.data.assetClass,
        kind: parsed.data.kind,
      },
    });

    return { account, investmentAccount };
  });

  return NextResponse.json({
    investmentAccountId: updated.investmentAccount.id,
    assetClass: updated.investmentAccount.assetClass,
    kind: updated.investmentAccount.kind,
    account: updated.account,
  });
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

  const existing = await prisma.investmentAccount.findUnique({
    where: { id },
    include: {
      account: true,
    },
  });

  if (!existing || existing.userId !== user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const [transactionCount, tradeCount, valuationCount] = await Promise.all([
    prisma.transaction.count({
      where: { accountId: existing.accountId, userId: user.id },
    }),
    prisma.investmentTransaction.count({
      where: { investmentAccountId: id, userId: user.id },
    }),
    prisma.investmentValuation.count({
      where: { investmentAccountId: id, userId: user.id },
    }),
  ]);

  if (transactionCount > 0 || tradeCount > 0 || valuationCount > 1) {
    return NextResponse.json(
      {
        error: "Account has activity and cannot be deleted",
      },
      { status: 400 }
    );
  }

  await prisma.$transaction(async (tx) => {
    await tx.investmentValuation.deleteMany({
      where: { investmentAccountId: id, userId: user.id },
    });
    await tx.investmentAccount.delete({ where: { id } });
    await tx.financialAccount.delete({ where: { id: existing.accountId } });
  });

  return NextResponse.json({ success: true });
}
