import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedUser, unauthorizedResponse } from "@/lib/auth-helpers";
import { z } from "zod";

const importSchema = z.object({
  version: z.string(),
  categories: z.array(z.object({
    name: z.string(),
    type: z.enum(["INCOME", "EXPENSE", "TRANSFER"]),
    color: z.string().nullable(),
    icon: z.string().nullable(),
    budgetLimit: z.number().nullable(),
    parentName: z.string().nullable(),
    parentType: z.enum(["INCOME", "EXPENSE", "TRANSFER"]).nullable(),
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

    const { categories } = parsed.data;
    const results = {
      imported: 0,
      skipped: 0,
      errors: [] as string[],
    };

    // Sort categories to ensure parents are created before children
    const sortedCategories = [...categories].sort((a, b) => {
      // Categories without parents come first
      if (!a.parentName && b.parentName) return -1;
      if (a.parentName && !b.parentName) return 1;
      return a.name.localeCompare(b.name);
    });

    // First pass: create categories without parents
    for (const category of sortedCategories.filter(c => !c.parentName)) {
      try {
        const existingCategory = await prisma.category.findFirst({
          where: {
            userId: user.id,
            name: category.name,
            type: category.type,
          },
        });

        if (existingCategory) {
          results.errors.push(`Category already exists: ${category.name} (${category.type})`);
          results.skipped++;
          continue;
        }

        await prisma.category.create({
          data: {
            userId: user.id,
            name: category.name,
            type: category.type,
            color: category.color,
            icon: category.icon,
            budgetLimit: category.budgetLimit,
            parentId: null,
          },
        });

        results.imported++;
      } catch (error) {
        results.errors.push(`Failed to import category "${category.name}": ${error instanceof Error ? error.message : 'Unknown error'}`);
        results.skipped++;
      }
    }

    // Second pass: create categories with parents
    for (const category of sortedCategories.filter(c => c.parentName)) {
      try {
        const existingCategory = await prisma.category.findFirst({
          where: {
            userId: user.id,
            name: category.name,
            type: category.type,
          },
        });

        if (existingCategory) {
          results.errors.push(`Category already exists: ${category.name} (${category.type})`);
          results.skipped++;
          continue;
        }

        let parentId: string | null = null;
        if (category.parentName && category.parentType) {
          const parent = await prisma.category.findFirst({
            where: {
              userId: user.id,
              name: category.parentName,
              type: category.parentType,
            },
          });

          if (!parent) {
            results.errors.push(`Parent category not found: ${category.parentName} (${category.parentType})`);
            results.skipped++;
            continue;
          }
          parentId = parent.id;
        }

        await prisma.category.create({
          data: {
            userId: user.id,
            name: category.name,
            type: category.type,
            color: category.color,
            icon: category.icon,
            budgetLimit: category.budgetLimit,
            parentId,
          },
        });

        results.imported++;
      } catch (error) {
        results.errors.push(`Failed to import category "${category.name}": ${error instanceof Error ? error.message : 'Unknown error'}`);
        results.skipped++;
      }
    }

    return NextResponse.json(results);
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to process import file" },
      { status: 400 }
    );
  }
}