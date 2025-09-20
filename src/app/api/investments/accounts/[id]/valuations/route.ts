import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  getAuthenticatedUser,
  unauthorizedResponse,
} from "@/lib/auth-helpers";
import { investmentValuationSchema } from "@/lib/validators";
import { upsertInvestmentAccountValuation } from "@/app/api/investments/helpers";

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

  const valuations = await prisma.investmentValuation.findMany({
    where: { investmentAccountId: id, userId: user.id },
    orderBy: { asOf: "desc" },
  });

  const payload = valuations.map((valuation) => ({
    id: valuation.id,
    value: valuation.value,
    asOf: valuation.asOf.toISOString(),
    createdAt: valuation.createdAt.toISOString(),
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
  const parsed = investmentValuationSchema
    .safeParse({ ...body, investmentAccountId: id });

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const { value, asOf } = parsed.data;

  const latest = await prisma.investmentValuation.findFirst({
    where: { investmentAccountId: id, userId: user.id },
    orderBy: { asOf: "desc" },
  });

  if (latest && latest.asOf > asOf) {
    return NextResponse.json(
      { error: { asOf: ["Valuation date must be after the latest recorded valuation"] } },
      { status: 400 }
    );
  }

  const valuation = await prisma.$transaction((tx) =>
    upsertInvestmentAccountValuation({
      tx,
      userId: user.id,
      investmentAccountId: id,
      financialAccountId: investment.accountId,
      openingBalance: investment.account.openingBalance,
      asOf,
      value,
    })
  );

  return NextResponse.json(
    {
      id: valuation.id,
      value: valuation.value,
      asOf: valuation.asOf.toISOString(),
      createdAt: valuation.createdAt.toISOString(),
    },
    { status: 201 }
  );
}
