import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { accountSchema } from "@/lib/validators";
import { getAuthenticatedUser, unauthorizedResponse } from "@/lib/auth-helpers";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const user = await getAuthenticatedUser();
  if (!user?.id) {
    return unauthorizedResponse();
  }

  const data = await request.json();
  const parsed = accountSchema.safeParse({ ...data, id });

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const existing = await prisma.financialAccount.findUnique({
    where: { id },
  });

  if (!existing || existing.userId !== user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const updated = await prisma.financialAccount.update({
    where: { id },
    data: {
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

  return NextResponse.json(updated);
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

  const existing = await prisma.financialAccount.findUnique({
    where: { id },
  });

  if (!existing || existing.userId !== user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const transactionsCount = await prisma.transaction.count({
    where: { accountId: id, userId: user.id },
  });

  if (transactionsCount > 0) {
    return NextResponse.json(
      { error: "Account has transactions and cannot be deleted" },
      { status: 400 }
    );
  }

  await prisma.financialAccount.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
