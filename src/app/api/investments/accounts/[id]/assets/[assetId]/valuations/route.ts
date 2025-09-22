import { NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedUser, unauthorizedResponse } from "@/lib/auth-helpers";
import { investmentAssetValuationSchema } from "@/lib/validators";
import { upsertInvestmentAccountValuation } from "@/app/api/investments/helpers";

function normalizeQuantity(value?: string | null) {
  if (!value) return null;
  try {
    return new Prisma.Decimal(value);
  } catch {
    return null;
  }
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string; assetId: string }> }
) {
  const { id, assetId } = await params;
  const user = await getAuthenticatedUser();
  if (!user?.id) {
    return unauthorizedResponse();
  }

  const asset = await prisma.investmentAsset.findUnique({
    where: { id: assetId },
    include: {
      account: {
        select: { id: true, userId: true },
      },
    },
  });

  if (!asset || asset.account.id !== id || asset.userId !== user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const valuations = await prisma.investmentAssetValuation.findMany({
    where: {
      investmentAssetId: assetId,
      userId: user.id,
    },
    orderBy: { asOf: "desc" },
  });

  const payload = valuations.map((valuation) => ({
    id: valuation.id,
    value: valuation.value,
    quantity: valuation.quantity?.toString() ?? null,
    asOf: valuation.asOf.toISOString(),
    createdAt: valuation.createdAt.toISOString(),
  }));

  return NextResponse.json(payload);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; assetId: string }> }
) {
  const { id, assetId } = await params;
  const user = await getAuthenticatedUser();
  if (!user?.id) {
    return unauthorizedResponse();
  }

  const asset = await prisma.investmentAsset.findUnique({
    where: { id: assetId },
    include: {
      account: {
        include: {
          account: true,
        },
      },
    },
  });

  if (!asset || asset.account.id !== id || asset.userId !== user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await request.json();
  const parsed = investmentAssetValuationSchema.safeParse({
    ...body,
    investmentAssetId: assetId,
  });

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const { value, asOf, quantity } = parsed.data;

  const valuation = await prisma.$transaction(async (tx) => {
    const upserted = await tx.investmentAssetValuation.upsert({
      where: {
        investmentAssetId_asOf: {
          investmentAssetId: assetId,
          asOf,
        },
      },
      update: {
        value,
        quantity: normalizeQuantity(quantity),
      },
      create: {
        userId: user.id,
        investmentAssetId: assetId,
        value,
        quantity: normalizeQuantity(quantity),
        asOf,
      },
    });

    const aggregate = await tx.investmentAssetValuation.aggregate({
      where: {
        asOf,
        asset: {
          investmentAccountId: asset.account.id,
          userId: user.id,
        },
      },
      _sum: { value: true },
    });

    const totalValue = aggregate._sum.value ?? 0;

    await upsertInvestmentAccountValuation({
      tx,
      userId: user.id,
      investmentAccountId: asset.account.id,
      financialAccountId: asset.account.accountId,
      openingBalance: asset.account.account.openingBalance,
      asOf,
      value: totalValue,
    });

    return upserted;
  });

  return NextResponse.json(
    {
      id: valuation.id,
      value: valuation.value,
      quantity: valuation.quantity?.toString() ?? null,
      asOf: valuation.asOf.toISOString(),
      createdAt: valuation.createdAt.toISOString(),
    },
    { status: 201 }
  );
}
