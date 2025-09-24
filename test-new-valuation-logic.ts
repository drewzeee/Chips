import "dotenv/config";
import { PrismaClient } from "@/generated/prisma";

const prisma = new PrismaClient();

// Test the new valuation logic manually
(async () => {
  console.log("🧪 Testing new valuation logic...\n");

  try {
    const user = await prisma.user.findFirst();
    if (!user) {
      throw new Error("No user found");
    }

    // Find the Traditional IRA account
    const iraAccount = await prisma.investmentAccount.findFirst({
      where: {
        userId: user.id,
        account: {
          name: { contains: "Traditional IRA", mode: "insensitive" }
        }
      },
      include: {
        account: true,
        valuations: {
          orderBy: { asOf: "desc" },
          take: 1
        }
      }
    });

    if (!iraAccount) {
      throw new Error("Traditional IRA not found");
    }

    console.log(`🏦 Testing: ${iraAccount.account.name}`);
    console.log(`   Opening Balance: $${(iraAccount.account.openingBalance / 100).toLocaleString()}`);

    // Calculate current account balance from all transactions (new logic)
    const transactions = await prisma.transaction.findMany({
      where: {
        userId: user.id,
        accountId: iraAccount.accountId
      }
    });

    let currentAccountValue = iraAccount.account.openingBalance;
    for (const tx of transactions) {
      currentAccountValue += tx.amount;
    }

    const currentValueInDollars = currentAccountValue / 100;

    console.log(`\n💰 New Valuation Calculation:`);
    console.log(`   Opening Balance: $${(iraAccount.account.openingBalance / 100).toLocaleString()}`);
    console.log(`   + All Transactions: $${(transactions.reduce((sum, tx) => sum + tx.amount, 0) / 100).toLocaleString()}`);
    console.log(`   = Total Account Value: $${currentValueInDollars.toLocaleString()}`);

    // Get previous valuation for comparison
    const previousValue = iraAccount.valuations[0]?.value || iraAccount.account.openingBalance;
    const change = currentAccountValue - previousValue;
    const changePercent = previousValue > 0 ? (change / previousValue) * 100 : 0;

    console.log(`\n📊 Comparison:`);
    console.log(`   Previous Valuation: $${(previousValue / 100).toLocaleString()}`);
    console.log(`   New Valuation: $${currentValueInDollars.toLocaleString()}`);
    console.log(`   Change: $${(change / 100).toLocaleString()} (${changePercent.toFixed(2)}%)`);

    console.log(`\n✅ Expected Result:`);
    console.log(`   Should now capture: $27,412.02 (equities) + $15,189.51 (cash) = $42,601.53`);
    console.log(`   Calculated value: $${currentValueInDollars.toLocaleString()}`);

    if (Math.abs(currentValueInDollars - 42601.53) < 1) {
      console.log(`   🎉 SUCCESS: Values match expected amount!`);
    } else {
      console.log(`   ⚠️  Difference: $${Math.abs(currentValueInDollars - 42601.53).toFixed(2)}`);
    }

  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    await prisma.$disconnect();
  }
})();