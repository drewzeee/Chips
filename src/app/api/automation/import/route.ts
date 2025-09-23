import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { importPayloadSchema } from "@/lib/validators";
import {
  findBestTransferCandidate,
  markTransactionsAsTransfer,
  applyCategorizationRules,
} from "../../transactions/utils";

function normalizeKey(date: Date, amount: number, description: string) {
  return `${date.toISOString().slice(0, 10)}|${amount}|${description.trim().toLowerCase()}`;
}

// Internal automation key for secure imports
const AUTOMATION_KEY = process.env.AUTOMATION_KEY || "change-me-in-production";

function isAuthorizedAutomation(request: Request): string | null {
  const authHeader = request.headers.get("authorization");
  const automationKey = request.headers.get("x-automation-key");
  const userId = request.headers.get("x-user-id");

  if (automationKey === AUTOMATION_KEY && userId) {
    return userId;
  }

  if (authHeader?.startsWith("Bearer ") && authHeader.split(" ")[1] === AUTOMATION_KEY && userId) {
    return userId;
  }

  return null;
}

export async function POST(request: Request) {
  const userId = isAuthorizedAutomation(request);
  if (!userId) {
    return NextResponse.json(
      { error: "Unauthorized - invalid automation key or user ID" },
      { status: 401 }
    );
  }

  const { searchParams } = new URL(request.url);
  const dryRun = searchParams.get("dryRun") === "true";

  const body = await request.json();
  const parsed = importPayloadSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const account = await prisma.financialAccount.findUnique({
    where: { id: parsed.data.accountId },
  });

  if (!account || account.userId !== userId) {
    return NextResponse.json({ error: "Invalid account" }, { status: 400 });
  }

  const rows = parsed.data.rows.map((row) => ({
    ...row,
    date: new Date(row.date),
  }));

  const minDate = new Date(Math.min(...rows.map((row) => row.date.getTime())));
  const maxDate = new Date(Math.max(...rows.map((row) => row.date.getTime())));

  const rangeStart = new Date(minDate);
  rangeStart.setHours(0, 0, 0, 0);

  const rangeEnd = new Date(maxDate);
  rangeEnd.setHours(23, 59, 59, 999);

  const existing = await prisma.transaction.findMany({
    where: {
      userId: userId,
      accountId: account.id,
      date: {
        gte: rangeStart,
        lte: rangeEnd,
      },
    },
    select: {
      id: true,
      date: true,
      amount: true,
      description: true,
    },
  });

  const existingSet = new Set(
    existing.map((item) => normalizeKey(item.date, item.amount, item.description))
  );

  const duplicates: typeof rows = [];
  const uniqueRows = [] as typeof rows;

  for (const row of rows) {
    const key = normalizeKey(row.date, row.amount, row.description);
    if (existingSet.has(key)) {
      duplicates.push(row);
    } else {
      uniqueRows.push(row);
    }
  }

  if (dryRun) {
    return NextResponse.json({
      duplicates: duplicates.length,
      importable: uniqueRows.length,
      total: rows.length,
    });
  }

  if (uniqueRows.length === 0) {
    return NextResponse.json({
      message: "No new transactions to import",
      imported: 0,
      duplicates: duplicates.length,
      importTag: null
    });
  }

  const categoryIds = uniqueRows
    .map((row) => row.categoryId)
    .filter((value): value is string => Boolean(value));

  const categories = categoryIds.length
    ? await prisma.category.findMany({ where: { id: { in: categoryIds } } })
    : [];

  if (
    categoryIds.length > 0 &&
    (categories.length !== categoryIds.length || categories.some((c) => c.userId !== userId))
  ) {
    return NextResponse.json({ error: "Invalid categories supplied" }, { status: 400 });
  }

  const createdTransactionIds: string[] = [];
  const importTag = uniqueRows.length > 0 ? `automation_${Date.now()}` : null;

  await prisma.$transaction(async (tx) => {
    for (const row of uniqueRows) {
      const transaction = await tx.transaction.create({
        data: {
          userId: userId,
          accountId: account.id,
          date: row.date,
          amount: row.amount,
          description: row.description,
          merchant: row.merchant ?? null,
          reference: row.reference ?? null,
          status: "CLEARED",
          pending: false,
          importTag: importTag ?? undefined,
        },
        select: {
          id: true,
        },
      });

      createdTransactionIds.push(transaction.id);

      if (row.categoryId) {
        await tx.transactionSplit.create({
          data: {
            transactionId: transaction.id,
            categoryId: row.categoryId,
            amount: row.amount,
            userId: userId,
          },
        });
      }
    }

    if (parsed.data.template) {
      await tx.importTemplate.upsert({
        where: {
          userId_name: {
            userId: userId,
            name: parsed.data.template.name,
          },
        },
        create: {
          userId: userId,
          name: parsed.data.template.name,
          mappings: JSON.stringify(parsed.data.template.mappings),
        },
        update: {
          mappings: JSON.stringify(parsed.data.template.mappings),
        },
      });
    }
  });

  // Apply transfer matching and categorization rules
  for (const transactionId of createdTransactionIds) {
    const transaction = await prisma.transaction.findUnique({
      where: { id: transactionId },
      include: {
        account: true,
      },
    });

    if (!transaction || transaction.userId !== userId || !transaction.account) {
      continue;
    }

    const transferMatch = await findBestTransferCandidate({
      userId: userId,
      account: transaction.account,
      transaction,
      existingReference: transaction.reference,
    });

    if (transferMatch) {
      await markTransactionsAsTransfer({
        transactionA: transaction,
        transactionB: transferMatch.transaction,
      });
    }

    await applyCategorizationRules({ transactionId, userId: userId });
  }

  return NextResponse.json({
    imported: uniqueRows.length,
    duplicates: duplicates.length,
    importTag,
  });
}