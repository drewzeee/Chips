import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedUser, unauthorizedResponse } from "@/lib/auth-helpers";
import { transactionRuleSchema } from "@/lib/validators";
import { parseAmountToCents } from "@/lib/utils";

export async function GET() {
  const user = await getAuthenticatedUser();
  if (!user?.id) {
    return unauthorizedResponse();
  }

  const rules = await prisma.transactionRule.findMany({
    where: { userId: user.id },
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
    orderBy: { priority: "asc" },
  });

  return NextResponse.json(rules);
}

export async function POST(request: Request) {
  const user = await getAuthenticatedUser();
  if (!user?.id) {
    return unauthorizedResponse();
  }

  const json = await request.json().catch(() => null);
  const parsed = transactionRuleSchema.omit({ id: true }).safeParse(json);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const data = parsed.data;
  const descriptionStartsWith = data.descriptionStartsWith?.trim() || null;
  const descriptionContains = data.descriptionContains?.trim() || null;
  const amountEquals = data.amountEquals ? Math.abs(parseAmountToCents(data.amountEquals)) : null;

  const rule = await prisma.transactionRule.create({
    data: {
      userId: user.id,
      name: data.name.trim(),
      categoryId: data.categoryId,
      accountId: data.accountId || null,
      descriptionStartsWith,
      descriptionContains,
      amountEquals,
      priority: data.priority ?? 100,
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

  return NextResponse.json(rule, { status: 201 });
}
