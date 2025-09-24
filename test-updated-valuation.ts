import "dotenv/config";
import { PrismaClient } from "@/generated/prisma";
import { calculateInvestmentAccountBalance } from "./src/lib/investment-calculations";

const prisma = new PrismaClient();

(async () => {
  console.log("🧪 Testing updated valuation calculation...\n");

  try {
    const user = await prisma.user.findFirst();
    if (!user) {
      throw new Error("No user found");
    }

    const iraAccount = await prisma.investmentAccount.findFirst({
      where: {
        userId: user.id,
        account: {
          name: { contains: "Traditional IRA", mode: "insensitive" }
        }
      },
      include: {
        account: true,
        trades: true,
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
    console.log(`   Total Trades: ${iraAccount.trades.length}`);

    // Use the updated calculation logic
    const balance = await calculateInvestmentAccountBalance(
      iraAccount.id,
      iraAccount.account.openingBalance,
      iraAccount.trades.map(trade => ({
        type: trade.type,
        assetType: trade.assetType,
        symbol: trade.symbol,
        quantity: trade.quantity?.toString() || null,
        amount: trade.amount,
        fees: trade.fees
      }))
    );

    console.log(`\n💰 Calculated Account Balance:`);
    console.log(`   Cash Balance: $${balance.cashBalance.toLocaleString()}`);
    console.log(`   Holdings Value: $${balance.holdingsValue.toLocaleString()}`);
    console.log(`   Total Value: $${balance.totalValue.toLocaleString()}`);

    console.log(`\n📊 Holdings Breakdown:`);
    for (const holding of balance.holdings) {
      console.log(`   ${holding.symbol}: ${holding.quantity} shares @ $${holding.marketValue.toLocaleString()}`);
    }

    console.log(`\n🎯 Comparison with UI:`);
    console.log(`   Expected Total: $42,601.53`);
    console.log(`   Expected Cash: $15,189.51`);
    console.log(`   Calculated Total: $${balance.totalValue.toLocaleString()}`);
    console.log(`   Calculated Cash: $${balance.cashBalance.toLocaleString()}`);

    const totalDiff = Math.abs(balance.totalValue - 42601.53);
    const cashDiff = Math.abs(balance.cashBalance - 15189.51);

    if (totalDiff < 1 && cashDiff < 1) {
      console.log(`   🎉 SUCCESS: Values match UI exactly!`);
    } else {
      console.log(`   📊 Differences:`);
      console.log(`     Total: $${totalDiff.toFixed(2)}`);
      console.log(`     Cash: $${cashDiff.toFixed(2)}`);
    }

    // Test what the valuation would be in cents
    const valueInCents = Math.round(balance.totalValue * 100);
    console.log(`\n💾 Value for database storage: ${valueInCents} cents`);

  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    await prisma.$disconnect();
  }
})();