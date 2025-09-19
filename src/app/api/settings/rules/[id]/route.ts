import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedUser, unauthorizedResponse } from "@/lib/auth-helpers";
import { transactionRuleSchema } from "@/lib/validators";
import { parseAmountToCents } from "@/lib/utils";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const user = await getAuthenticatedUser();
  if (!user?.id) {
    return unauthorizedResponse();
  }

  const json = await request.json().catch(() => null);
  const parsed = transactionRuleSchema.safeParse({ ...json, id });

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const data = parsed.data;
  const descriptionStartsWith = data.descriptionStartsWith?.trim() || null;
  const descriptionContains = data.descriptionContains?.trim() || null;
  const amountEquals = data.amountEquals && data.amountEquals.trim() !== "" ? Math.abs(parseAmountToCents(data.amountEquals)) : null;

  const existing = await prisma.transactionRule.findUnique({ where: { id } });
  if (!existing || existing.userId !== user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const rule = await prisma.transactionRule.update({
    where: { id },
    data: {
      name: data.name.trim(),
      categoryId: data.categoryId,
      accountId: data.accountId || null,
      descriptionStartsWith,
      descriptionContains,
      amountEquals,
      priority: data.priority ?? existing.priority,
    },
    include: {
      category: {
        select: {
          id: true,
          name: true,
          type: true,
        },
      },
      account: {
        select: {
          id: true,
          name: true,
          currency: true,
        },
      },
    },
  });

  return NextResponse.json(rule);
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

  const existing = await prisma.transactionRule.findUnique({ where: { id } });
  if (!existing || existing.userId !== user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.transactionRule.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
