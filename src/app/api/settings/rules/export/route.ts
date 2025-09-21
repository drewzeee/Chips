import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedUser, unauthorizedResponse } from "@/lib/auth-helpers";

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
          name: true,
          type: true,
        },
      },
      account: {
        select: {
          name: true,
          currency: true,
        },
      },
    },
    orderBy: { priority: "asc" },
  });

  const exportData = {
    version: "1.0",
    exportedAt: new Date().toISOString(),
    rules: rules.map(rule => ({
      name: rule.name,
      categoryName: rule.category.name,
      categoryType: rule.category.type,
      accountName: rule.account?.name || null,
      accountCurrency: rule.account?.currency || null,
      descriptionStartsWith: rule.descriptionStartsWith,
      descriptionContains: rule.descriptionContains,
      amountEquals: rule.amountEquals,
      priority: rule.priority,
    })),
  };

  const filename = `transaction-rules-${new Date().toISOString().split('T')[0]}.json`;

  return new NextResponse(JSON.stringify(exportData, null, 2), {
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}