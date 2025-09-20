import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedUser, unauthorizedResponse } from "@/lib/auth-helpers";
import { investmentAssetSchema } from "@/lib/validators";

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
    select: { userId: true },
  });

  if (!investment || investment.userId !== user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const assets = await prisma.investmentAsset.findMany({
    where: {
      investmentAccountId: id,
      userId: user.id,
    },
    include: {
      valuations: {
        orderBy: { asOf: "desc" },
        take: 10,
      },
      transactions: {
        orderBy: { occurredAt: "desc" },
        take: 5,
        select: {
          id: true,
          type: true,
          amount: true,
          occurredAt: true,
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  const payload = assets.map((asset) => ({
    id: asset.id,
    name: asset.name,
    symbol: asset.symbol,
    type: asset.type,
    createdAt: asset.createdAt.toISOString(),
    valuations: asset.valuations.map((valuation) => ({
      id: valuation.id,
      value: valuation.value,
      quantity: valuation.quantity?.toString() ?? null,
      asOf: valuation.asOf.toISOString(),
      createdAt: valuation.createdAt.toISOString(),
    })),
    recentTransactions: asset.transactions.map((transaction) => ({
      id: transaction.id,
      type: transaction.type,
      amount: transaction.amount,
      occurredAt: transaction.occurredAt.toISOString(),
    })),
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
    select: { userId: true },
  });

  if (!investment || investment.userId !== user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await request.json();
  const parsed = investmentAssetSchema
    .omit({ id: true })
    .safeParse({ ...body, investmentAccountId: id });

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const asset = await prisma.investmentAsset.create({
    data: {
      userId: user.id,
      investmentAccountId: id,
      name: parsed.data.name,
      symbol: parsed.data.symbol?.trim() || null,
      type: parsed.data.type,
    },
  });

  return NextResponse.json(
    {
      id: asset.id,
      name: asset.name,
      symbol: asset.symbol,
      type: asset.type,
      createdAt: asset.createdAt.toISOString(),
      valuations: [],
      recentTransactions: [],
    },
    { status: 201 }
  );
}
