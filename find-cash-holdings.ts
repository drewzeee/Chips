import "dotenv/config";
import { PrismaClient } from "@/generated/prisma";

const prisma = new PrismaClient();

(async () => {
  console.log("💰 Investigating cash holdings in Traditional IRA...\n");

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
        trades: true,
        assets: {
          include: {
            valuations: {
              orderBy: { asOf: "desc" },
              take: 1
            }
          }
        }
      }
    });

    if (!iraAccount) {
      throw new Error("Traditional IRA not found");
    }

    console.log(`🏦 Account: ${iraAccount.account.name}`);
    console.log(`   Opening Balance: $${(iraAccount.account.openingBalance / 100).toLocaleString()}`);

    // Check for cash assets
    console.log(`\n💵 Investment Assets in Account: ${iraAccount.assets.length}`);
    for (const asset of iraAccount.assets) {
      console.log(`   ${asset.name} (${asset.type}): ${asset.symbol || 'No symbol'}`);
      if (asset.valuations.length > 0) {
        console.log(`     Latest value: $${(asset.valuations[0].value / 100).toLocaleString()}`);
      }
    }

    // Get all transactions to understand cash flow
    const allTransactions = await prisma.transaction.findMany({
      where: {
        userId: user.id,
        accountId: iraAccount.account.id
      },
      orderBy: { date: "desc" }
    });

    console.log(`\n💳 Transaction Analysis: ${allTransactions.length} transactions`);

    // Separate different types of transactions
    const valuationAdjustments = allTransactions.filter(tx =>
      tx.reference?.startsWith('investment_valuation_')
    );

    const otherTransactions = allTransactions.filter(tx =>
      !tx.reference?.startsWith('investment_valuation_')
    );

    console.log(`   Valuation adjustments: ${valuationAdjustments.length}`);
    console.log(`   Other transactions: ${otherTransactions.length}`);

    // Calculate balance without valuation adjustments (this should show base cash)
    let baseBalance = iraAccount.account.openingBalance;
    for (const tx of otherTransactions) {
      baseBalance += tx.amount;
    }

    console.log(`\n📊 Balance Analysis:`);
    console.log(`   Opening Balance: $${(iraAccount.account.openingBalance / 100).toLocaleString()}`);
    console.log(`   After non-valuation transactions: $${(baseBalance / 100).toLocaleString()}`);

    // Calculate total after all transactions
    let totalBalance = iraAccount.account.openingBalance;
    for (const tx of allTransactions) {
      totalBalance += tx.amount;
    }
    console.log(`   After all transactions: $${(totalBalance / 100).toLocaleString()}`);

    // Calculate equity investments from trades
    let totalEquityInvestment = 0;
    for (const trade of iraAccount.trades) {
      if (trade.type === "BUY" && trade.amount) {
        totalEquityInvestment += trade.amount;
      } else if (trade.type === "SELL" && trade.amount) {
        totalEquityInvestment -= trade.amount;
      }
    }

    console.log(`\n💹 Equity Investment Analysis:`);
    console.log(`   Total invested in equities: $${(totalEquityInvestment / 100).toLocaleString()}`);

    const estimatedCash = baseBalance - totalEquityInvestment;
    console.log(`   Estimated cash position: $${(estimatedCash / 100).toLocaleString()}`);

    console.log(`\n🎯 Expected Account Composition:`);
    console.log(`   Equities (NVDA + GME): ~$27,412 (current market value)`);
    console.log(`   Cash: $${(estimatedCash / 100).toLocaleString()}`);
    console.log(`   Total Expected: $${((27412 * 100 + estimatedCash) / 100).toLocaleString()}`);

    // Check if there are any cash-related investment assets
    const cashAssets = iraAccount.assets.filter(asset =>
      asset.name.toLowerCase().includes('cash') ||
      asset.symbol === 'USD' ||
      asset.name.toLowerCase().includes('money market')
    );

    console.log(`\n💰 Cash Assets Found: ${cashAssets.length}`);
    for (const cashAsset of cashAssets) {
      console.log(`   ${cashAsset.name} (${cashAsset.type})`);
      if (cashAsset.valuations.length > 0) {
        console.log(`     Value: $${(cashAsset.valuations[0].value / 100).toLocaleString()}`);
      }
    }

    // Look for any cash-related trades
    const cashTrades = iraAccount.trades.filter(trade =>
      trade.symbol === 'USD' ||
      trade.symbol === 'CASH'
    );

    console.log(`\n💵 Cash-related trades: ${cashTrades.length}`);
    for (const trade of cashTrades) {
      console.log(`   ${trade.occurredAt.toISOString().split('T')[0]}: ${trade.type} ${trade.quantity} ${trade.symbol} ($${((trade.amount || 0) / 100).toFixed(2)})`);
    }

  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    await prisma.$disconnect();
  }
})();