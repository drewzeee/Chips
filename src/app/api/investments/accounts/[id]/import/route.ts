import { NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma";
import type { InvestmentTransactionType, InvestmentAssetType } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";
import {
  getAuthenticatedUser,
  unauthorizedResponse,
} from "@/lib/auth-helpers";
import { z } from "zod";

// Schema for the CSV row structure based on the provided example
const csvTransactionSchema = z.object({
  timestamp: z.string(),
  date: z.string(),
  transactionType: z.string(),
  coinIn: z.string().optional(),
  coinsIn: z.string().optional(),
  coinOut: z.string().optional(),
  coinsOut: z.string().optional(),
  usdValue: z.string(),
  gasTxFee: z.string().optional(),
  gasCoin: z.string().optional(),
  gasUsd: z.string().optional(),
  notes: z.string().optional(),
  costBasis: z.string().optional(),
});

const csvImportSchema = z.object({
  transactions: z.array(csvTransactionSchema),
  dryRun: z.boolean().optional().default(false),
});

function normalizeDecimal(input?: string | null) {
  if (!input || input.trim() === "") return null;
  // Remove currency symbols, commas, and quotes
  const cleaned = input.replace(/[$,"]/g, "").trim();
  if (!cleaned || cleaned === "0" || cleaned === "0.00") return null;
  try {
    return new Prisma.Decimal(cleaned);
  } catch {
    return null;
  }
}

function parseAmount(input?: string | null): number {
  if (!input || input.trim() === "") return 0;
  // Remove currency symbols, commas, and quotes
  const cleaned = input.replace(/[$,"]/g, "").trim();
  if (!cleaned) return 0;
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : Math.round(parsed * 100); // Convert to cents
}

function parseDate(dateStr: string): Date {
  // Handle MM/DD/YYYY format
  const parts = dateStr.split('/');
  if (parts.length === 3) {
    const month = parseInt(parts[0], 10) - 1; // Month is 0-indexed
    const day = parseInt(parts[1], 10);
    const year = parseInt(parts[2], 10);
    return new Date(year, month, day);
  }
  // Fallback to standard date parsing
  return new Date(dateStr);
}

function mapTransactionType(csvType: string): string {
  const type = csvType.toUpperCase();
  switch (type) {
    case "DEPOSIT":
      return "DEPOSIT";
    case "TRADE":
      return "BUY"; // Assume trades are buys for now
    case "INTEREST":
      return "INTEREST";
    case "RECONCILE":
      return "ADJUSTMENT";
    default:
      return "ADJUSTMENT";
  }
}

function buildDescription(type: string, symbol?: string | null) {
  const base = type.slice(0, 1) + type.slice(1).toLowerCase();
  return symbol ? `${base} ${symbol}` : base;
}

function normalizeKey(date: Date, amount: number, type: string, symbol?: string | null) {
  return `${date.toISOString().slice(0, 10)}|${amount}|${type}|${symbol || ""}`;
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

  // Verify the investment account exists and belongs to the user
  const investment = await prisma.investmentAccount.findUnique({
    where: { id },
    include: {
      account: true,
    },
  });

  if (!investment || investment.userId !== user.id) {
    return NextResponse.json({ error: "Investment account not found" }, { status: 404 });
  }

  const body = await request.json();
  const parsed = csvImportSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const { transactions, dryRun } = parsed.data;

  // Convert CSV transactions to our internal format
  const convertedTransactions: Array<{
    type: string;
    assetType: "CRYPTO";
    symbol: string | null;
    quantity: Prisma.Decimal | null;
    pricePerUnit: Prisma.Decimal | null;
    amount: number;
    fees: number | null;
    occurredAt: Date;
    notes: string | null;
    originalData: Record<string, string>;
  }> = [];

  for (const tx of transactions.filter(tx => tx.transactionType && tx.date && tx.usdValue)) {
    const baseType = mapTransactionType(tx.transactionType);
    const date = parseDate(tx.date);
    const totalAmount = parseAmount(tx.usdValue);
    const fees = parseAmount(tx.gasTxFee);

    if (tx.transactionType.toUpperCase() === "TRADE" && tx.coinIn && tx.coinsIn && tx.coinOut && tx.coinsOut) {
      // For trades, create two transactions: SELL the outgoing asset and BUY the incoming asset

      // SELL transaction (coin going out)
      const sellQuantity = normalizeDecimal(tx.coinsOut);
      const sellPricePerUnit = sellQuantity && totalAmount > 0
        ? new Prisma.Decimal(totalAmount / 100).div(sellQuantity)
        : null;

      convertedTransactions.push({
        type: "SELL",
        assetType: "CRYPTO" as const,
        symbol: tx.coinOut,
        quantity: sellQuantity,
        pricePerUnit: sellPricePerUnit,
        amount: totalAmount,
        fees: fees > 0 ? Math.round(fees / 2) : null, // Split fees between sell and buy
        occurredAt: date,
        notes: tx.notes?.trim() || `Trade: ${tx.coinOut} → ${tx.coinIn}`,
        originalData: tx,
      });

      // BUY transaction (coin coming in)
      const buyQuantity = normalizeDecimal(tx.coinsIn);
      const buyPricePerUnit = buyQuantity && totalAmount > 0
        ? new Prisma.Decimal(totalAmount / 100).div(buyQuantity)
        : null;

      convertedTransactions.push({
        type: "BUY",
        assetType: "CRYPTO" as const,
        symbol: tx.coinIn,
        quantity: buyQuantity,
        pricePerUnit: buyPricePerUnit,
        amount: totalAmount,
        fees: fees > 0 ? Math.ceil(fees / 2) : null, // Split fees between sell and buy
        occurredAt: date,
        notes: tx.notes?.trim() || `Trade: ${tx.coinOut} → ${tx.coinIn}`,
        originalData: tx,
      });
    } else {
      // Handle non-trade transactions (DEPOSIT, INTEREST, etc.)
      let symbol: string | null = null;
      let quantity: Prisma.Decimal | null = null;
      let pricePerUnit: Prisma.Decimal | null = null;

      if (tx.coinIn && tx.coinsIn) {
        symbol = tx.coinIn;
        quantity = normalizeDecimal(tx.coinsIn);
        if (quantity && totalAmount > 0) {
          pricePerUnit = new Prisma.Decimal(totalAmount / 100).div(quantity);
        }
      } else if (tx.coinOut && tx.coinsOut) {
        symbol = tx.coinOut;
        quantity = normalizeDecimal(tx.coinsOut);
        if (quantity && totalAmount > 0) {
          pricePerUnit = new Prisma.Decimal(totalAmount / 100).div(quantity);
        }
      }

      convertedTransactions.push({
        type: baseType,
        assetType: "CRYPTO" as const,
        symbol,
        quantity,
        pricePerUnit,
        amount: totalAmount,
        fees: fees > 0 ? fees : null,
        occurredAt: date,
        notes: tx.notes?.trim() || null,
        originalData: tx,
      });
    }
  }

  if (convertedTransactions.length === 0) {
    return NextResponse.json({ error: "No valid transactions found in CSV" }, { status: 400 });
  }

  // Check for duplicates
  const dateRange = convertedTransactions.reduce(
    (range, tx) => ({
      min: tx.occurredAt < range.min ? tx.occurredAt : range.min,
      max: tx.occurredAt > range.max ? tx.occurredAt : range.max,
    }),
    { min: convertedTransactions[0].occurredAt, max: convertedTransactions[0].occurredAt }
  );

  const rangeStart = new Date(dateRange.min);
  rangeStart.setHours(0, 0, 0, 0);

  const rangeEnd = new Date(dateRange.max);
  rangeEnd.setHours(23, 59, 59, 999);

  const existingTransactions = await prisma.investmentTransaction.findMany({
    where: {
      userId: user.id,
      investmentAccountId: id,
      occurredAt: {
        gte: rangeStart,
        lte: rangeEnd,
      },
    },
    select: {
      id: true,
      type: true,
      symbol: true,
      amount: true,
      occurredAt: true,
    },
  });

  const existingSet = new Set(
    existingTransactions.map(tx =>
      normalizeKey(tx.occurredAt, tx.amount, tx.type, tx.symbol)
    )
  );

  const duplicates: typeof convertedTransactions = [];
  const uniqueTransactions: typeof convertedTransactions = [];

  for (const tx of convertedTransactions) {
    const key = normalizeKey(tx.occurredAt, tx.amount, tx.type, tx.symbol);
    if (existingSet.has(key)) {
      duplicates.push(tx);
    } else {
      uniqueTransactions.push(tx);
    }
  }

  if (dryRun) {
    return NextResponse.json({
      total: convertedTransactions.length,
      duplicates: duplicates.length,
      importable: uniqueTransactions.length,
      preview: uniqueTransactions.slice(0, 5).map(tx => ({
        type: tx.type,
        symbol: tx.symbol,
        quantity: tx.quantity?.toString(),
        amount: tx.amount,
        date: tx.occurredAt.toISOString().slice(0, 10),
      })),
    });
  }

  if (uniqueTransactions.length === 0) {
    return NextResponse.json({
      message: "No new transactions to import",
      duplicates: duplicates.length,
    });
  }

  // Import the transactions
  const importTag = `csv_import_${Date.now()}`;
  const createdTransactions: Array<{
    id: string;
    type: string;
    symbol: string | null;
    amount: number;
    occurredAt: Date;
  }> = [];

  await prisma.$transaction(async (tx) => {
    for (const transaction of uniqueTransactions) {
      // Create investment transaction
      const investmentTx = await tx.investmentTransaction.create({
        data: {
          userId: user.id,
          investmentAccountId: id,
          type: transaction.type as InvestmentTransactionType,
          assetType: transaction.assetType as InvestmentAssetType,
          symbol: transaction.symbol,
          quantity: transaction.quantity,
          pricePerUnit: transaction.pricePerUnit,
          amount: transaction.amount,
          fees: transaction.fees,
          occurredAt: transaction.occurredAt,
          notes: transaction.notes,
        },
      });

      // Create corresponding financial transaction
      await tx.transaction.create({
        data: {
          userId: user.id,
          accountId: investment.accountId,
          date: transaction.occurredAt,
          amount: transaction.amount,
          description: buildDescription(transaction.type, transaction.symbol),
          status: "CLEARED",
          reference: `investment_trade_${investmentTx.id}`,
          memo: transaction.notes,
          importTag,
        },
      });

      createdTransactions.push({
        id: investmentTx.id,
        type: investmentTx.type,
        symbol: investmentTx.symbol,
        amount: investmentTx.amount,
        occurredAt: investmentTx.occurredAt,
      });
    }
  });

  return NextResponse.json({
    imported: uniqueTransactions.length,
    duplicates: duplicates.length,
    importTag,
    transactions: createdTransactions,
  });
}