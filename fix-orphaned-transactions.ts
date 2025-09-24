import { prisma } from './src/lib/prisma';

async function fixOrphanedTransactions() {
  console.log('🔧 Fixing Orphaned Valuation Transactions');
  console.log('=' .repeat(45));

  try {
    // Find all valuation adjustment transactions
    const valuationTransactions = await prisma.transaction.findMany({
      where: {
        reference: {
          startsWith: 'investment_valuation_'
        }
      },
      select: {
        id: true,
        reference: true,
        amount: true,
        date: true,
        description: true,
        accountId: true
      }
    });

    console.log(`📊 Found ${valuationTransactions.length} valuation adjustment transactions`);

    // Check which ones are orphaned (no corresponding valuation record)
    const orphanedTransactions = [];

    for (const tx of valuationTransactions) {
      const valuationId = tx.reference?.replace('investment_valuation_', '');
      if (valuationId) {
        const valuation = await prisma.investmentValuation.findUnique({
          where: { id: valuationId }
        });

        if (!valuation) {
          orphanedTransactions.push(tx);
        }
      }
    }

    console.log(`⚠️  Found ${orphanedTransactions.length} orphaned transactions:`);

    let totalOrphanedAmount = 0;
    for (const tx of orphanedTransactions) {
      console.log(`- ${tx.id}: $${(tx.amount / 100).toLocaleString()} on ${tx.date.toISOString().split('T')[0]}`);
      console.log(`  Reference: ${tx.reference}`);
      totalOrphanedAmount += tx.amount;
    }

    console.log(`\n💰 Total orphaned amount: $${(totalOrphanedAmount / 100).toLocaleString()}`);

    if (orphanedTransactions.length > 0) {
      console.log(`\n🗑️  Deleting ${orphanedTransactions.length} orphaned transactions...`);

      const deleteResult = await prisma.transaction.deleteMany({
        where: {
          id: {
            in: orphanedTransactions.map(tx => tx.id)
          }
        }
      });

      console.log(`✅ Deleted ${deleteResult.count} orphaned transactions`);
    } else {
      console.log(`✅ No orphaned transactions found`);
    }

    // Now run the original orphaned valuations cleanup
    console.log('\n🧹 Cleaning up orphaned valuations...');

    const allValuations = await prisma.investmentValuation.findMany({
      select: { id: true, investmentAccountId: true, asOf: true, value: true }
    });

    const referencedValuationIds = valuationTransactions
      .map(tx => tx.reference?.replace('investment_valuation_', ''))
      .filter(Boolean);

    const orphanedValuations = allValuations.filter(val =>
      !referencedValuationIds.includes(val.id)
    );

    if (orphanedValuations.length > 0) {
      console.log(`⚠️  Found ${orphanedValuations.length} orphaned valuations`);

      const valuationDeleteResult = await prisma.investmentValuation.deleteMany({
        where: {
          id: {
            in: orphanedValuations.map(v => v.id)
          }
        }
      });

      console.log(`✅ Deleted ${valuationDeleteResult.count} orphaned valuations`);
    } else {
      console.log(`✅ No orphaned valuations found`);
    }

    console.log('\n🎉 Cleanup completed successfully!');

  } catch (error) {
    console.error('❌ Error during cleanup:', error);
  } finally {
    await prisma.$disconnect();
  }
}

fixOrphanedTransactions();