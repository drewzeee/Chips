import { prisma } from './src/lib/prisma';
import { calculateInvestmentAccountBalance } from './src/lib/investment-calculations';

async function cleanupIncorrectValuations() {
  console.log('🧹 Cleaning Up Incorrect Valuations');
  console.log('=' .repeat(45));

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
        trades: true
      }
    });

    if (!iraAccount) {
      throw new Error("Traditional IRA not found");
    }

    console.log(`🏦 Processing: ${iraAccount.account.name}`);

    // Calculate the correct current value
    const correctBalance = await calculateInvestmentAccountBalance(
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

    const correctValueInCents = Math.round(correctBalance.totalValue * 100);
    console.log(`✅ Correct current value: $${correctBalance.totalValue.toLocaleString()}`);
    console.log(`   Cash: $${correctBalance.cashBalance.toLocaleString()}`);
    console.log(`   Holdings: $${correctBalance.holdingsValue.toLocaleString()}`);

    // Find all valuations for this account
    const allValuations = await prisma.investmentValuation.findMany({
      where: {
        userId: user.id,
        investmentAccountId: iraAccount.id
      },
      orderBy: { asOf: "desc" }
    });

    console.log(`\n📊 Found ${allValuations.length} total valuations`);

    // Define what we consider "incorrect" valuations
    // These are likely the ones that missed the cash component
    const incorrectValueInCents = 2741202; // $27,412.02 - the value missing cash
    const tolerance = 100; // $1 tolerance

    const incorrectValuations = allValuations.filter(val =>
      Math.abs(val.value - incorrectValueInCents) < tolerance
    );

    console.log(`\n⚠️  Found ${incorrectValuations.length} incorrect valuations around $27,412.02:`);
    for (const val of incorrectValuations.slice(0, 10)) { // Show first 10
      console.log(`   ${val.asOf.toISOString().split('T')[0]}: $${(val.value / 100).toLocaleString()}`);
    }
    if (incorrectValuations.length > 10) {
      console.log(`   ... and ${incorrectValuations.length - 10} more`);
    }

    // Also find any valuations that are clearly wrong (too far from expected range)
    const minReasonableValue = 2000000; // $20,000 minimum
    const maxReasonableValue = 10000000; // $100,000 maximum

    const unreasonableValuations = allValuations.filter(val =>
      val.value < minReasonableValue || val.value > maxReasonableValue
    );

    console.log(`\n🚨 Found ${unreasonableValuations.length} unreasonable valuations (outside $20k-$100k range):`);
    for (const val of unreasonableValuations.slice(0, 5)) {
      console.log(`   ${val.asOf.toISOString().split('T')[0]}: $${(val.value / 100).toLocaleString()}`);
    }

    // Combine all valuations to remove
    const toRemove = new Set([
      ...incorrectValuations.map(v => v.id),
      ...unreasonableValuations.map(v => v.id)
    ]);

    console.log(`\n🗑️  Total valuations to remove: ${toRemove.size}`);

    if (toRemove.size > 0) {
      // Get the associated transactions that need to be removed too
      const associatedTransactions = await prisma.transaction.findMany({
        where: {
          reference: {
            in: Array.from(toRemove).map(id => `investment_valuation_${id}`)
          }
        }
      });

      console.log(`💸 Found ${associatedTransactions.length} associated adjustment transactions to remove`);

      // Proceed with cleanup
      console.log(`\n🧹 Starting cleanup...`);

      // Remove associated transactions first
      if (associatedTransactions.length > 0) {
        const transactionDeleteResult = await prisma.transaction.deleteMany({
          where: {
            id: {
              in: associatedTransactions.map(tx => tx.id)
            }
          }
        });
        console.log(`✅ Deleted ${transactionDeleteResult.count} adjustment transactions`);
      }

      // Remove the incorrect valuations
      const valuationDeleteResult = await prisma.investmentValuation.deleteMany({
        where: {
          id: {
            in: Array.from(toRemove)
          }
        }
      });

      console.log(`✅ Deleted ${valuationDeleteResult.count} incorrect valuations`);

      // Show remaining valuations
      const remainingValuations = await prisma.investmentValuation.findMany({
        where: {
          userId: user.id,
          investmentAccountId: iraAccount.id
        },
        orderBy: { asOf: "desc" },
        take: 5
      });

      console.log(`\n📊 Remaining valuations (latest 5):`);
      for (const val of remainingValuations) {
        console.log(`   ${val.asOf.toISOString().split('T')[0]}: $${(val.value / 100).toLocaleString()}`);
      }

    } else {
      console.log(`✅ No incorrect valuations found to remove`);
    }

    console.log(`\n🎉 Cleanup completed successfully!`);

  } catch (error) {
    console.error('❌ Error during cleanup:', error);
  } finally {
    await prisma.$disconnect();
  }
}

cleanupIncorrectValuations();