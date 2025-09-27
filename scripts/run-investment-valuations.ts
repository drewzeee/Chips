#!/usr/bin/env tsx

import "dotenv/config";
import { PrismaClient } from "@/generated/prisma";
import { calculateInvestmentAccountBalance } from "@/lib/investment-calculations";
import { upsertInvestmentAccountValuation } from "@/app/api/investments/helpers";

interface CliOptions {
  userId?: string;
  dryRun: boolean;
}

const prisma = new PrismaClient();

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = { dryRun: false };

  for (const arg of argv) {
    if (arg === "--dry-run") {
      options.dryRun = true;
    } else if (arg.startsWith("--user=")) {
      const value = arg.split("=")[1]?.trim();
      if (value) {
        options.userId = value;
      }
    }
  }

  return options;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const runTimestamp = new Date();

  console.log("\n🚀 Starting investment valuation run");
  if (options.dryRun) {
    console.log("   Mode: dry-run (no database writes)\n");
  }

  const users = await prisma.user.findMany({
    where: {
      ...(options.userId ? { id: options.userId } : {}),
      investmentAccounts: {
        some: {},
      },
    },
    select: {
      id: true,
      email: true,
      investmentAccounts: {
        include: {
          account: true,
          trades: {
            orderBy: { occurredAt: "asc" },
          },
          valuations: {
            orderBy: { asOf: "desc" },
            take: 1,
          },
        },
      },
    },
  });

  if (users.length === 0) {
    console.log("No users with investment accounts found. Exiting.\n");
    return;
  }

  let totalAccounts = 0;
  let totalUpdated = 0;
  const errors: Array<{ account: string; message: string }> = [];

  for (const user of users) {
    console.log(`\n👤 Processing ${user.email} (${user.investmentAccounts.length} accounts)`);

    for (const account of user.investmentAccounts) {
      totalAccounts += 1;

      try {
        const balance = await calculateInvestmentAccountBalance(
          account.id,
          account.account.openingBalance,
          account.trades.map((trade) => ({
            type: trade.type,
            assetType: trade.assetType,
            symbol: trade.symbol,
            quantity: trade.quantity?.toString() ?? null,
            amount: trade.amount,
            fees: trade.fees ?? null,
          }))
        );

        const currentValueInCents = Math.round(balance.totalValue * 100);
        const previousValue = account.valuations[0]?.value ?? account.account.openingBalance;
        const change = currentValueInCents - previousValue;
        const changePercent = previousValue > 0 ? (change / previousValue) * 100 : 0;

        if (options.dryRun) {
          console.log(
            `   • ${account.account.name}: would update to $${(currentValueInCents / 100).toLocaleString()} (${change >= 0 ? "+" : ""}$${(change / 100).toFixed(2)}, ${changePercent.toFixed(2)}%)`
          );
          continue;
        }

        await prisma.$transaction((tx) =>
          upsertInvestmentAccountValuation({
            tx,
            userId: user.id,
            investmentAccountId: account.id,
            financialAccountId: account.accountId,
            openingBalance: account.account.openingBalance,
            asOf: runTimestamp,
            value: currentValueInCents,
          })
        );

        totalUpdated += 1;

        console.log(
          `   • ${account.account.name}: updated to $${(currentValueInCents / 100).toLocaleString()} (${change >= 0 ? "+" : ""}$${(change / 100).toFixed(2)}, ${changePercent.toFixed(2)}%)`
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        errors.push({ account: account.account.name, message });
        console.error(`   ⚠️  Failed to update ${account.account.name}: ${message}`);
      }
    }
  }

  console.log("\n📊 Valuation run summary");
  console.log(`   Accounts processed: ${totalAccounts}`);
  console.log(`   Valuations ${options.dryRun ? "evaluated" : "updated"}: ${totalUpdated}`);
  if (errors.length > 0) {
    console.log(`   Accounts with errors: ${errors.length}`);
    for (const error of errors) {
      console.log(`     - ${error.account}: ${error.message}`);
    }
  }

  console.log("\n✅ Valuation run complete\n");
}

main()
  .catch((error) => {
    console.error("\n❌ Valuation run failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
