import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { fetchCoinbaseAccounts, fetchCoinbaseTransactions } from "@/lib/integrations/coinbase";

const REQUIRED_TOKEN = process.env.COINBASE_SYNC_TOKEN;
const BANK_ACCOUNT_ID = process.env.COINBASE_BANK_ACCOUNT_ID;
const MATCH_LOOKBACK_HOURS = 48;

function unauthorizedResponse() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export async function POST(request: Request) {
  if (REQUIRED_TOKEN) {
    const authHeader = request.headers.get("authorization");
    if (!authHeader || authHeader !== `Bearer ${REQUIRED_TOKEN}`) {
      return unauthorizedResponse();
    }
  }

  if (!process.env.COINBASE_API_KEY || !process.env.COINBASE_API_SECRET) {
    return NextResponse.json({ error: "Coinbase credentials not configured" }, { status: 500 });
  }

  const coinbaseAccounts = await fetchCoinbaseAccounts();

  const dbAccounts = await prisma.financialAccount.findMany({
    where: {
      externalAccountId: { not: null },
      institution: { equals: "Coinbase", mode: "insensitive" },
    },
  });

  const accountMap = new Map(dbAccounts.map((account) => [account.externalAccountId!, account]));

  const now = new Date();
  const asOf = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const syncTag = `coinbase_sync_${asOf.toISOString().slice(0, 10)}`;
  const snapshotsCreated: string[] = [];
  const withdrawalsRecorded: string[] = [];

  for (const account of coinbaseAccounts) {
    const linkedAccount = accountMap.get(account.id);
    if (!linkedAccount) {
      continue;
    }

    const rawAmount = Number.parseFloat(account.balance.amount);
    if (!Number.isFinite(rawAmount)) {
      continue;
    }
    const balanceCents = Math.round(rawAmount * 100);

    await prisma.accountBalanceSnapshot.upsert({
      where: {
        accountId_asOf: {
          accountId: linkedAccount.id,
          asOf,
        },
      },
      update: {
        balance: balanceCents,
        source: "coinbase",
      },
      create: {
        userId: linkedAccount.userId,
        accountId: linkedAccount.id,
        balance: balanceCents,
        asOf,
        source: "coinbase",
      },
    });

    snapshotsCreated.push(`${linkedAccount.name}:${balanceCents}`);
  }

  if (BANK_ACCOUNT_ID) {
    const bankAccount = await prisma.financialAccount.findUnique({ where: { id: BANK_ACCOUNT_ID } });
    if (!bankAccount) {
      return NextResponse.json({
        error: "Configured bank account not found",
        snapshots: snapshotsCreated.length,
      }, { status: 400 });
    }

    const withdrawalWindow = new Date(Date.now() - MATCH_LOOKBACK_HOURS * 60 * 60 * 1000);

    for (const account of coinbaseAccounts) {
      const transactions = await fetchCoinbaseTransactions(account.id, { limit: 50 });

      for (const transaction of transactions) {
        if (transaction.type !== "send") continue;
        if (transaction.status !== "completed") continue;
        if (!transaction.to) continue;

        const destination = transaction.to.resource ?? transaction.to.type ?? "";
        if (destination !== "bank_account" && destination !== "fiat_account") {
          continue;
        }

        const createdAt = new Date(transaction.created_at);
        if (createdAt < withdrawalWindow) {
          continue;
        }

        const reference = `coinbase_withdrawal_${transaction.id}`;
        const alreadyExists = await prisma.transaction.findFirst({
          where: {
            userId: bankAccount.userId,
            reference,
          },
        });
        if (alreadyExists) {
          continue;
        }

        const amountValue = Number.parseFloat(transaction.amount.amount);
        if (!Number.isFinite(amountValue)) {
          continue;
        }

        if (transaction.amount.currency !== bankAccount.currency) {
          continue;
        }

        const amountCents = Math.round(Math.abs(amountValue) * 100);
        if (amountCents === 0) {
          continue;
        }

        await prisma.transaction.create({
          data: {
            userId: bankAccount.userId,
            accountId: bankAccount.id,
            date: createdAt,
            amount: amountCents,
            description: transaction.details?.subtitle ?? transaction.details?.title ?? "Coinbase withdrawal",
            merchant: "Coinbase",
            status: "CLEARED",
            pending: false,
            reference,
            importTag: syncTag,
          },
        });

        withdrawalsRecorded.push(reference);
      }
    }
  }

  return NextResponse.json({
    snapshots: snapshotsCreated.length,
    withdrawals: withdrawalsRecorded.length,
    importTag: syncTag,
  });
}
