import { prisma } from './src/lib/prisma';
import { calculateInvestmentAccountBalance } from './src/lib/investment-calculations';

async function testDashboardBalance() {
  console.log('🧪 Testing Dashboard Balance Calculation');
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

    // Get accounts just like dashboard does
    const [accounts, investmentAccounts] = await Promise.all([
      prisma.financialAccount.findMany({
        where: { userId },
        orderBy: { name: "asc" },
      }),
      prisma.investmentAccount.findMany({
        where: { userId },
        include: {
          trades: {
            orderBy: { occurredAt: "desc" },
          },
        },
      }),
    ]);

    console.log(`\n📊 Found ${accounts.length} accounts, ${investmentAccounts.length} investment accounts`);

    // Create investment account map
    const investmentAccountMap = new Map(
      investmentAccounts.map((inv) => [inv.accountId, inv])
    );

    console.log('\n🏦 Account Balance Analysis:');

    for (const account of accounts) {
      const investmentAccount = investmentAccountMap.get(account.id);

      if (investmentAccount) {
        console.log(`\n📈 ${account.name} (Investment Account):`);

        // Calculate investment balance
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

        const balance = Math.round(accountBalance.totalValue * 100);

        console.log(`  Opening Balance: $${(account.openingBalance / 100).toFixed(2)}`);
        console.log(`  Total Value: $${accountBalance.totalValue.toFixed(2)}`);
        console.log(`  Cash Position: $${accountBalance.cashBalance.toFixed(2)}`);
        console.log(`  Holdings Value: $${accountBalance.holdingsValue.toFixed(2)}`);
        console.log(`  Dashboard Balance (cents): ${balance}`);
        console.log(`  Dashboard Balance (dollars): $${(balance / 100).toFixed(2)}`);

        if (accountBalance.holdings.length > 0) {
          console.log(`  Holdings:`);
          for (const holding of accountBalance.holdings) {
            console.log(`    - ${holding.symbol}: ${holding.quantity} @ $${(holding.marketValue / holding.quantity).toFixed(2)} = $${holding.marketValue.toFixed(2)}`);
          }
        }
      } else {
        console.log(`\n🏛️  ${account.name} (Regular Account):`);
        // Get transaction totals for regular accounts
        const transactionTotal = await prisma.transaction.aggregate({
          where: { userId, accountId: account.id },
          _sum: { amount: true },
        });

        const balance = account.openingBalance + (transactionTotal._sum.amount ?? 0);
        console.log(`  Opening Balance: $${(account.openingBalance / 100).toFixed(2)}`);
        console.log(`  Transaction Sum: $${((transactionTotal._sum.amount ?? 0) / 100).toFixed(2)}`);
        console.log(`  Total Balance: $${(balance / 100).toFixed(2)}`);
      }
    }

  } catch (error) {
    console.error('❌ Error during analysis:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testDashboardBalance();