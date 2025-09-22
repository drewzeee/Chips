import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  getAuthenticatedUser,
  unauthorizedResponse,
} from "@/lib/auth-helpers";
import { investmentAccountSchema } from "@/lib/validators";
import { calculateInvestmentAccountBalance } from "@/lib/investment-calculations";

export async function GET() {
  const user = await getAuthenticatedUser();
  if (!user?.id) {
    return unauthorizedResponse();
  }

  const accounts = await prisma.investmentAccount.findMany({
    where: { userId: user.id },
    include: {
      account: true,
      trades: {
        orderBy: { occurredAt: "asc" },
      },
      valuations: {
        orderBy: { asOf: "desc" },
        take: 1,
      },
    },
    orderBy: { createdAt: "asc" },
  });

  const payload = await Promise.all(
    accounts.map(async (item) => {
      // Use the investment calculation logic to get accurate balance
      const investmentBalance = await calculateInvestmentAccountBalance(
        item.id,
        item.account.openingBalance,
        item.trades.map(trade => ({
          type: trade.type,
          assetType: trade.assetType,
          symbol: trade.symbol,
          quantity: trade.quantity?.toString() || null,
          amount: trade.amount,
          fees: trade.fees,
        }))
      );

      return {
        investmentAccountId: item.id,
        assetClass: item.assetClass,
        kind: item.kind,
        account: item.account,
        balance: Math.round(investmentBalance.totalValue * 100), // Convert to cents for consistency
        latestValuation: item.valuations[0]
          ? {
              value: item.valuations[0].value,
              asOf: item.valuations[0].asOf,
            }
          : null,
      };
    })
  );

  return NextResponse.json(payload);
}

export async function POST(request: Request) {
  const user = await getAuthenticatedUser();
  if (!user?.id) {
    return unauthorizedResponse();
  }

  const body = await request.json();
  const parsed = investmentAccountSchema
    .omit({ id: true })
    .safeParse({ ...body, type: "INVESTMENT" });

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const now = new Date();

  const result = await prisma.$transaction(async (tx) => {
    const account = await tx.financialAccount.create({
      data: {
        userId: user.id,
        name: parsed.data.name,
        type: "INVESTMENT",
        currency: parsed.data.currency.toUpperCase(),
        openingBalance: parsed.data.openingBalance,
        creditLimit: parsed.data.creditLimit ?? null,
        status: parsed.data.status,
        institution: parsed.data.institution ?? null,
        notes: parsed.data.notes ?? null,
      },
    });

    const investmentAccount = await tx.investmentAccount.create({
      data: {
        userId: user.id,
        accountId: account.id,
        assetClass: parsed.data.assetClass,
        kind: parsed.data.kind,
      },
    });

    if (parsed.data.openingBalance !== 0) {
      await tx.investmentValuation.create({
        data: {
          userId: user.id,
          investmentAccountId: investmentAccount.id,
          value: parsed.data.openingBalance,
          asOf: now,
        },
      });
    }

    return { account, investmentAccount };
  });

  return NextResponse.json(
    {
      investmentAccountId: result.investmentAccount.id,
      assetClass: result.investmentAccount.assetClass,
      kind: result.investmentAccount.kind,
      account: result.account,
      latestValuation:
        result.account.openingBalance !== 0
          ? {
              value: result.account.openingBalance,
              asOf: now,
            }
          : null,
    },
    { status: 201 }
  );
}
