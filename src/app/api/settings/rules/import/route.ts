import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedUser, unauthorizedResponse } from "@/lib/auth-helpers";
import { z } from "zod";

const importSchema = z.object({
  version: z.string(),
  rules: z.array(z.object({
    name: z.string(),
    categoryName: z.string(),
    categoryType: z.enum(["INCOME", "EXPENSE", "TRANSFER"]),
    accountName: z.string().nullable(),
    accountCurrency: z.string().nullable(),
    descriptionStartsWith: z.string().nullable(),
    descriptionContains: z.string().nullable(),
    amountEquals: z.number().nullable(),
    priority: z.number(),
  })),
});

export async function POST(request: Request) {
  const user = await getAuthenticatedUser();
  if (!user?.id) {
    return unauthorizedResponse();
  }

  try {
    const json = await request.json();
    const parsed = importSchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid import format", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { rules } = parsed.data;
    const results = {
      imported: 0,
      skipped: 0,
      errors: [] as string[],
    };

    for (const rule of rules) {
      try {
        let categoryId: string | null = null;
        let accountId: string | null = null;

        const category = await prisma.category.findFirst({
          where: {
            userId: user.id,
            name: rule.categoryName,
            type: rule.categoryType,
          },
        });

        if (!category) {
          results.errors.push(`Category not found: ${rule.categoryName} (${rule.categoryType})`);
          results.skipped++;
          continue;
        }
        categoryId = category.id;

        if (rule.accountName && rule.accountCurrency) {
          const account = await prisma.financialAccount.findFirst({
            where: {
              userId: user.id,
              name: rule.accountName,
              currency: rule.accountCurrency,
            },
          });

          if (!account) {
            results.errors.push(`Account not found: ${rule.accountName} (${rule.accountCurrency})`);
            results.skipped++;
            continue;
          }
          accountId = account.id;
        }

        const existingRule = await prisma.transactionRule.findFirst({
          where: {
            userId: user.id,
            name: rule.name,
          },
        });

        if (existingRule) {
          results.errors.push(`Rule already exists: ${rule.name}`);
          results.skipped++;
          continue;
        }

        await prisma.transactionRule.create({
          data: {
            userId: user.id,
            name: rule.name,
            categoryId,
            accountId,
            descriptionStartsWith: rule.descriptionStartsWith,
            descriptionContains: rule.descriptionContains,
            amountEquals: rule.amountEquals,
            priority: rule.priority,
          },
        });

        results.imported++;
      } catch (error) {
        results.errors.push(`Failed to import rule "${rule.name}": ${error instanceof Error ? error.message : 'Unknown error'}`);
        results.skipped++;
      }
    }

    return NextResponse.json(results);
  } catch {
    return NextResponse.json(
      { error: "Failed to process import file" },
      { status: 400 }
    );
  }
}