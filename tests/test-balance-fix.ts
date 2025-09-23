// Test script for testing the investment balance calculation fix
import { prisma } from '../src/lib/prisma';
import { calculateInvestmentAccountBalance } from '../src/lib/investment-calculations';

async function testBalanceFix() {
  console.log("🧪 Testing Investment Balance Fix");
  console.log("=".repeat(50));

  try {
    // Find a user and their investment accounts with transactions
    const user = await prisma.user.findFirst({
      include: {
        investmentAccounts: {
          include: {
            account: true,
            trades: {
              orderBy: { occurredAt: 'asc' }
            }
          }
        }
      }
    });

    if (!user) {
      console.log("❌ No users found in database");
      return;
    }

    if (user.investmentAccounts.length === 0) {
      console.log("❌ No investment accounts found for user");
      return;
    }

    console.log(`📊 Testing with user: ${user.email}`);
    console.log(`📈 Found ${user.investmentAccounts.length} investment accounts`);

    // Test each investment account
    for (const investmentAccount of user.investmentAccounts) {
      console.log(`\n📋 Testing balance for account: ${investmentAccount.account.name}`);
      console.log(`- Opening Balance: $${(investmentAccount.account.openingBalance / 100).toFixed(2)}`);
      console.log(`- Total Trades: ${investmentAccount.trades.length}`);

      // Show breakdown of trades by type
      const tradesByType = investmentAccount.trades.reduce((acc, trade) => {
        acc[trade.type] = (acc[trade.type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      console.log("- Trade breakdown:");
      Object.entries(tradesByType).forEach(([type, count]) => {
        console.log(`  • ${type}: ${count} transactions`);
      });

      // Calculate balance using our new function
      const investmentBalance = await calculateInvestmentAccountBalance(
        investmentAccount.id,
        investmentAccount.account.openingBalance,
        investmentAccount.trades.map(trade => ({
          type: trade.type,
          assetType: trade.assetType,
          symbol: trade.symbol,
          quantity: trade.quantity?.toString() || null,
          amount: trade.amount,
          fees: trade.fees,
        }))
      );

      console.log("✅ Calculated Balance:");
      console.log(`- Total Value: $${investmentBalance.totalValue.toFixed(2)}`);
      console.log(`- Cash Balance: $${investmentBalance.cashBalance.toFixed(2)}`);
      console.log(`- Holdings Value: $${investmentBalance.holdingsValue.toFixed(2)}`);
      console.log(`- Number of Holdings: ${investmentBalance.holdings.length}`);

      // Show holdings breakdown if any
      if (investmentBalance.holdings.length > 0) {
        console.log("\n💰 Holdings breakdown:");
        for (const holding of investmentBalance.holdings) {
          console.log(`  • ${holding.symbol} (${holding.assetType}): ${holding.quantity} units @ $${holding.marketValue.toFixed(2)}`);
        }
      }

      // Test specific issue: Show how withdrawals affect the balance
      const withdrawals = investmentAccount.trades.filter(t => t.type === 'WITHDRAW');
      if (withdrawals.length > 0) {
        console.log(`\n🏦 Withdrawal Analysis (${withdrawals.length} withdrawals):`);
        let runningCash = investmentAccount.account.openingBalance / 100;

        for (const withdrawal of withdrawals) {
          const amount = withdrawal.amount / 100; // Convert cents to dollars
          // If amount is negative, it's already a withdrawal amount, so add it
          // If amount is positive, subtract it
          runningCash += amount; // Handle both positive and negative stored amounts
          console.log(`  • Withdrawal of $${amount.toFixed(2)} - Cash Balance: $${runningCash.toFixed(2)}`);
        }

        console.log(`  → Final expected cash after withdrawals: $${runningCash.toFixed(2)}`);
        console.log(`  → Calculated cash balance: $${investmentBalance.cashBalance.toFixed(2)}`);

        if (Math.abs(runningCash - investmentBalance.cashBalance) < 0.01) {
          console.log("  ✅ Withdrawal calculation is CORRECT");
        } else {
          console.log("  ❌ Withdrawal calculation is INCORRECT");
        }
      }
    }

  } catch (error) {
    console.error("❌ Test failed:", error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the test
testBalanceFix();