import "dotenv/config";
import { PrismaClient } from "@/generated/prisma";

const prisma = new PrismaClient();

(async () => {
  console.log("🔍 Checking for Bitcoin transactions and investment accounts...\n");

  try {
    // Find all users
    const users = await prisma.user.findMany();
    console.log(`Found ${users.length} user(s)`);

    for (const user of users) {
      console.log(`\n👤 User: ${user.email} (${user.id})`);

      // Check for investment accounts
      const investmentAccounts = await prisma.investmentAccount.findMany({
        where: { userId: user.id },
        include: {
          account: true,
          assets: {
            include: {
              transactions: true,
              valuations: true
            }
          },
          trades: true,
          valuations: {
            orderBy: { asOf: 'desc' },
            take: 3
          }
        }
      });

      console.log(`  📊 Investment accounts: ${investmentAccounts.length}`);

      for (const invAccount of investmentAccounts) {
        console.log(`    🏦 ${invAccount.account.name} (${invAccount.account.type})`);
        console.log(`       Opening balance: $${(invAccount.account.openingBalance / 100).toFixed(2)}`);

        if (invAccount.assets.length > 0) {
          console.log(`       📈 Assets: ${invAccount.assets.length}`);
          for (const asset of invAccount.assets) {
            console.log(`         • ${asset.name} (${asset.symbol})`);
            if (asset.transactions.length > 0) {
              console.log(`           Transactions: ${asset.transactions.length}`);
              for (const trade of asset.transactions) {
                console.log(`             - ${trade.type}: ${trade.quantity} ${asset.symbol} @ $${(Number(trade.pricePerUnit) || 0).toFixed(2)} on ${trade.occurredAt.toDateString()}`);
              }
            }
            if (asset.valuations.length > 0) {
              console.log(`           Asset valuations: ${asset.valuations.length} recent entries`);
            }
          }
        }

        if (invAccount.valuations.length > 0) {
          console.log(`       💰 Recent valuations:`);
          for (const val of invAccount.valuations) {
            console.log(`         ${val.asOf.toDateString()}: $${(val.value / 100).toFixed(2)}`);
          }
        }
      }

      // Check for transactions mentioning Bitcoin/BTC
      const bitcoinTransactions = await prisma.transaction.findMany({
        where: {
          userId: user.id,
          description: { contains: "bitcoin", mode: "insensitive" }
        },
        include: {
          account: true
        }
      });

      // Check for investment transactions with Bitcoin/BTC
      const bitcoinInvestmentTx = await prisma.investmentTransaction.findMany({
        where: {
          userId: user.id,
          OR: [
            { symbol: { contains: "BTC", mode: "insensitive" } },
            { notes: { contains: "bitcoin", mode: "insensitive" } }
          ]
        },
        include: {
          account: {
            include: {
              account: true
            }
          },
          asset: true
        }
      });

      if (bitcoinTransactions.length > 0) {
        console.log(`  ₿ Bitcoin-related transactions: ${bitcoinTransactions.length}`);
        for (const tx of bitcoinTransactions) {
          console.log(`    💳 ${tx.description} | $${(tx.amount / 100).toFixed(2)} | ${tx.date.toDateString()} | Account: ${tx.account.name}`);
        }
      }

      if (bitcoinInvestmentTx.length > 0) {
        console.log(`  ₿ Bitcoin investment transactions: ${bitcoinInvestmentTx.length}`);
        for (const tx of bitcoinInvestmentTx) {
          console.log(`    🔄 ${tx.type}: ${tx.quantity} ${tx.symbol} @ $${(Number(tx.pricePerUnit) || 0).toFixed(2)} | $${(tx.amount / 100).toFixed(2)} | ${tx.occurredAt.toDateString()}`);
          console.log(`       Account: ${tx.account.account.name}`);
          if (tx.asset) console.log(`       Asset: ${tx.asset.name}`);
          if (tx.notes) console.log(`       Notes: ${tx.notes}`);
        }
      }
    }

  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    await prisma.$disconnect();
  }
})();