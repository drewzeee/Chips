import "dotenv/config";
import { PrismaClient } from "@/generated/prisma";

const prisma = new PrismaClient();

(async () => {
  console.log("🔍 Verifying Bitcoin valuation results...\n");

  try {
    const user = await prisma.user.findFirst();
    if (!user) {
      throw new Error("No user found");
    }

    // Find the Growth Fund investment account
    const growthFund = await prisma.investmentAccount.findFirst({
      where: {
        userId: user.id,
        account: {
          name: "Growth Fund"
        }
      },
      include: {
        account: true,
        valuations: {
          orderBy: { asOf: 'desc' },
          take: 3
        }
      }
    });

    if (!growthFund) {
      throw new Error("Growth Fund not found");
    }

    console.log(`🏦 Account: ${growthFund.account.name}`);
    console.log(`   Opening Balance: $${(growthFund.account.openingBalance / 100).toLocaleString()}`);

    // Get all transactions for this account
    const transactions = await prisma.transaction.findMany({
      where: {
        userId: user.id,
        accountId: growthFund.account.id
      },
      orderBy: { date: 'desc' }
    });

    console.log(`\n💳 Transactions (${transactions.length}):`);
    let runningTotal = growthFund.account.openingBalance;

    for (const tx of transactions.reverse()) {
      runningTotal += tx.amount;
      console.log(`   ${tx.date.toDateString()}: ${tx.description}`);
      console.log(`     Amount: $${(tx.amount / 100).toLocaleString()}`);
      console.log(`     Balance: $${(runningTotal / 100).toLocaleString()}`);
      if (tx.reference) console.log(`     Reference: ${tx.reference}`);
    }

    console.log(`\n📊 Investment Valuations:`);
    for (const val of growthFund.valuations) {
      console.log(`   ${val.asOf.toDateString()}: $${(val.value / 100).toLocaleString()}`);
    }

    // Calculate current account balance
    const totalTransactions = transactions.reduce((sum, tx) => sum + tx.amount, 0);
    const currentBalance = growthFund.account.openingBalance + totalTransactions;

    console.log(`\n✅ Summary:`);
    console.log(`   Original BTC purchase: $20,000 at $40,000/BTC (0.5 BTC)`);
    console.log(`   Current BTC price: ~$115,753`);
    console.log(`   Expected value: 0.5 × $115,753 = $57,876.50`);
    console.log(`   Current account balance: $${(currentBalance / 100).toLocaleString()}`);
    console.log(`   Gain: $${((currentBalance - 2000000) / 100).toLocaleString()}`);

    // Get Bitcoin investment transaction details
    const bitcoinTx = await prisma.investmentTransaction.findFirst({
      where: {
        userId: user.id,
        symbol: { contains: "BTC", mode: "insensitive" }
      }
    });

    if (bitcoinTx) {
      const originalValue = bitcoinTx.amount / 100;
      const currentValue = currentBalance / 100;
      const gainPercent = ((currentValue - originalValue) / originalValue) * 100;

      console.log(`   Return: ${gainPercent.toFixed(1)}%`);
    }

  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    await prisma.$disconnect();
  }
})();