import { prisma } from '../src/lib/prisma';
import { calculateInvestmentAccountBalance } from '../src/lib/investment-calculations';

async function testAccountsPage() {
  console.log('🧪 Testing Accounts Page Balance Calculation');
  console.log('=' .repeat(50));

  try {
    // Get the first user ID
    const user = await prisma.user.findFirst();
    if (!user) {
      console.log('❌ No users found in database');
      return;
    }
    const userId = user.id;
    console.log(`👤 Using user ID: ${userId}`);

    // Replicate accounts page logic exactly
    const [accounts, investmentAccounts, transactionGroups] = await Promise.all([
      prisma.financialAccount.findMany({
        where: { userId },
        orderBy: { createdAt: "asc" },
      }),
      prisma.investmentAccount.findMany({
        where: { userId },
        include: {
          trades: {
            orderBy: { occurredAt: "desc" },
          },
        },
      }),
      prisma.transaction.groupBy({
        by: ["accountId"],
        where: { userId },
        _sum: { amount: true },
      }),
    ]);

    const totals = new Map(
      transactionGroups.map((item) => [item.accountId, item._sum.amount ?? 0])
    );

    // Create a map of financial account ID to investment account for quick lookup
    const investmentAccountMap = new Map(
      investmentAccounts.map((inv) => [inv.accountId, inv])
    );

    console.log('\n🏦 Accounts Page Balance Results:');

    for (const account of accounts) {
      const investmentAccount = investmentAccountMap.get(account.id);

      let balance;

      if (investmentAccount) {
        console.log(`\n📈 ${account.name} (Investment Account):`);

        // For investment accounts, use the proper calculation including market values
        const accountBalance = await calculateInvestmentAccountBalance(
          investmentAccount.id,
          account.openingBalance,
          investmentAccount.trades.map(trade => ({
            type: trade.type,
            assetType: trade.assetType,
            symbol: trade.symbol,
            quantity: trade.quantity?.toString() ?? null,
            amount: trade.amount,
            fees: trade.fees,
          }))
        );

        // Convert from dollars to cents for consistent display
        balance = Math.round(accountBalance.totalValue * 100);

        console.log(`  Opening Balance: $${(account.openingBalance / 100).toFixed(2)}`);
        console.log(`  Total Value: $${accountBalance.totalValue.toFixed(2)}`);
        console.log(`  Cash Position: $${accountBalance.cashBalance.toFixed(2)}`);
        console.log(`  Holdings Value: $${accountBalance.holdingsValue.toFixed(2)}`);
        console.log(`  Accounts Page Balance (cents): ${balance}`);
        console.log(`  Accounts Page Balance (dollars): $${(balance / 100).toFixed(2)}`);

        if (accountBalance.holdings.length > 0) {
          console.log(`  Holdings:`);
          for (const holding of accountBalance.holdings) {
            console.log(`    - ${holding.symbol}: ${holding.quantity} @ $${(holding.marketValue / holding.quantity).toFixed(2)} = $${holding.marketValue.toFixed(2)}`);
          }
        }
      } else {
        console.log(`\n🏛️  ${account.name} (Regular Account):`);
        // For regular accounts, use simple transaction sum
        balance = account.openingBalance + (totals.get(account.id) ?? 0);

        console.log(`  Opening Balance: $${(account.openingBalance / 100).toFixed(2)}`);
        console.log(`  Transaction Sum: $${((totals.get(account.id) ?? 0) / 100).toFixed(2)}`);
        console.log(`  Total Balance: $${(balance / 100).toFixed(2)}`);
      }
    }

  } catch (error) {
    console.error('❌ Error during analysis:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testAccountsPage();