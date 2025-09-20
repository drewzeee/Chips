import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { accountSchema } from "@/lib/validators";
import { getAuthenticatedUser, unauthorizedResponse } from "@/lib/auth-helpers";

export async function GET() {
  const user = await getAuthenticatedUser();
  if (!user?.id) {
    return unauthorizedResponse();
  }

  const [accounts, transactionGroups] = await Promise.all([
    prisma.financialAccount.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "asc" },
    }),
    prisma.transaction.groupBy({
      by: ["accountId"],
      where: { userId: user.id },
      _sum: { amount: true },
    }),
  ]);

  const totals = new Map(
    transactionGroups.map((group) => [group.accountId, group._sum.amount ?? 0])
  );

  const payload = accounts.map((account) => ({
    ...account,
    balance: account.openingBalance + (totals.get(account.id) ?? 0),
  }));

  return NextResponse.json(payload);
}

export async function POST(request: Request) {
  const user = await getAuthenticatedUser();
  if (!user?.id) {
    return unauthorizedResponse();
  }

  const data = await request.json();
  const parsed = accountSchema.omit({ id: true }).safeParse(data);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const account = await prisma.financialAccount.create({
    data: {
      userId: user.id,
      name: parsed.data.name,
      type: parsed.data.type,
      currency: parsed.data.currency.toUpperCase(),
      openingBalance: parsed.data.openingBalance,
      creditLimit: parsed.data.creditLimit ?? null,
      status: parsed.data.status,
      institution: parsed.data.institution ?? null,
      externalAccountId: parsed.data.externalAccountId ?? null,
      notes: parsed.data.notes ?? null,
    },
  });

  return NextResponse.json(account, { status: 201 });
}
