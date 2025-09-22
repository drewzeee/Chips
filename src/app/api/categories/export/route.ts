import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedUser, unauthorizedResponse } from "@/lib/auth-helpers";

export async function GET() {
  const user = await getAuthenticatedUser();
  if (!user?.id) {
    return unauthorizedResponse();
  }

  const categories = await prisma.category.findMany({
    where: { userId: user.id },
    include: {
      parent: {
        select: {
          name: true,
          type: true,
        },
      },
    },
    orderBy: [{ type: "asc" }, { name: "asc" }],
  });

  const exportData = {
    version: "1.0",
    exportedAt: new Date().toISOString(),
    categories: categories.map(category => ({
      name: category.name,
      type: category.type,
      color: category.color,
      icon: category.icon,
      budgetLimit: category.budgetLimit,
      parentName: category.parent?.name || null,
      parentType: category.parent?.type || null,
    })),
  };

  const filename = `categories-${new Date().toISOString().split('T')[0]}.json`;

  return new NextResponse(JSON.stringify(exportData, null, 2), {
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}