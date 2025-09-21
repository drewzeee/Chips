import { NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";
import {
  getAuthenticatedUser,
  unauthorizedResponse,
} from "@/lib/auth-helpers";
import { investmentTransactionSchema } from "@/lib/validators";

function normalizeDecimal(input?: string | null) {
  const value = (input ?? "").trim();
  if (!value) {
    return null;
  }
  return new Prisma.Decimal(value);
}

function buildDescription(type: string, symbol?: string | null) {
  const base = type.slice(0, 1) + type.slice(1).toLowerCase();
  return symbol ? `${base} ${symbol}` : base;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const user = await getAuthenticatedUser();
  if (!user?.id) {
    return unauthorizedResponse();
  }

  const investment = await prisma.investmentAccount.findUnique({
    where: { id },
    select: {
      userId: true,
    },
  });

  if (!investment || investment.userId !== user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const trades = await prisma.investmentTransaction.findMany({
    where: { investmentAccountId: id, userId: user.id },
    orderBy: { occurredAt: "desc" },
  });

  const payload = trades.map((trade) => ({
    id: trade.id,
    type: trade.type,
    assetType: trade.assetType,
    symbol: trade.symbol,
    quantity: trade.quantity ? trade.quantity.toString() : null,
    pricePerUnit: trade.pricePerUnit ? trade.pricePerUnit.toString() : null,
    amount: trade.amount,
    fees: trade.fees ?? null,
    occurredAt: trade.occurredAt.toISOString(),
    notes: trade.notes,
  }));

  return NextResponse.json(payload);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const user = await getAuthenticatedUser();
  if (!user?.id) {
    return unauthorizedResponse();
  }

  const investment = await prisma.investmentAccount.findUnique({
    where: { id },
    include: {
      account: true,
    },
  });

  if (!investment || investment.userId !== user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await request.json();
  const parsed = investmentTransactionSchema
    .omit({ id: true, investmentAccountId: true })
    .safeParse({ ...body, investmentAccountId: id });

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const { type, assetType, symbol, quantity, pricePerUnit, amount, fees, occurredAt, notes } = parsed.data;

  if (["BUY", "SELL"].includes(type)) {
    if (!assetType) {
      return NextResponse.json(
        { error: { assetType: ["Asset type is required for trades"] } },
        { status: 400 }
      );
    }
    if (!symbol || !symbol.trim()) {
      return NextResponse.json(
        { error: { symbol: ["Symbol is required for trades"] } },
        { status: 400 }
      );
    }
    if (!quantity || !quantity.trim()) {
      return NextResponse.json(
        { error: { quantity: ["Quantity is required for trades"] } },
        { status: 400 }
      );
    }
    if (!pricePerUnit || !pricePerUnit.trim()) {
      return NextResponse.json(
        { error: { pricePerUnit: ["Price per unit is required for trades"] } },
        { status: 400 }
      );
    }
  }

  const normalizedQuantity = normalizeDecimal(quantity ?? null);
  const normalizedPrice = normalizeDecimal(pricePerUnit ?? null);

  const trade = await prisma.$transaction(async (tx) => {
    const created = await tx.investmentTransaction.create({
      data: {
        userId: user.id,
        investmentAccountId: investment.id,
        type,
        assetType: assetType ?? null,
        symbol: symbol?.trim() || null,
        quantity: normalizedQuantity,
        pricePerUnit: normalizedPrice,
        amount,
        fees: fees ?? null,
        notes: notes?.trim() || null,
        occurredAt,
      },
    });

    await tx.transaction.create({
      data: {
        userId: user.id,
        accountId: investment.accountId,
        date: occurredAt,
        amount,
        description: buildDescription(type, symbol?.trim()),
        status: "CLEARED",
        reference: `investment_trade_${created.id}`,
        memo: notes?.trim() || null,
      },
    });

    return created;
  });

  return NextResponse.json(
    {
      id: trade.id,
      type: trade.type,
      assetType: trade.assetType,
      symbol: trade.symbol,
      quantity: trade.quantity ? trade.quantity.toString() : null,
      pricePerUnit: trade.pricePerUnit ? trade.pricePerUnit.toString() : null,
      amount: trade.amount,
      fees: trade.fees ?? null,
      occurredAt: trade.occurredAt.toISOString(),
      notes: trade.notes,
    },
    { status: 201 }
  );
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

  const investment = await prisma.investmentAccount.findUnique({
    where: { id },
    select: {
      userId: true,
    },
  });

  if (!investment || investment.userId !== user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const url = new URL(request.url);
  const tradeId = url.searchParams.get("tradeId");

  if (!tradeId) {
    return NextResponse.json({ error: "Trade ID is required" }, { status: 400 });
  }

  const existingTrade = await prisma.investmentTransaction.findUnique({
    where: { id: tradeId },
  });

  if (!existingTrade || existingTrade.userId !== user.id || existingTrade.investmentAccountId !== id) {
    return NextResponse.json({ error: "Trade not found" }, { status: 404 });
  }

  await prisma.$transaction(async (tx) => {
    // Delete the corresponding transaction record first
    await tx.transaction.deleteMany({
      where: {
        reference: `investment_trade_${tradeId}`,
        userId: user.id,
      },
    });

    // Delete the investment transaction
    await tx.investmentTransaction.delete({
      where: { id: tradeId },
    });
  });

  return NextResponse.json({ success: true });
}
