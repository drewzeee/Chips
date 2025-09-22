import { prisma } from './src/lib/prisma';

async function cleanupOrphanedValuations() {
  console.log('🧹 Cleaning Up Orphaned Valuations');
  console.log('=' .repeat(40));

  try {
    // Find all valuation transactions
    const valuationTransactions = await prisma.transaction.findMany({
      where: {
        reference: {
          startsWith: 'investment_valuation_'
        }
      },
      select: { reference: true }
    });

    const referencedValuationIds = valuationTransactions
      .map(tx => tx.reference?.replace('investment_valuation_', ''))
      .filter(Boolean);

    console.log(`📊 Found ${referencedValuationIds.length} valuations with transactions`);

    // Find all valuations
    const allValuations = await prisma.investmentValuation.findMany({
      select: { id: true, investmentAccountId: true, asOf: true, value: true }
    });

    // Find orphaned valuations
    const orphanedValuations = allValuations.filter(val =>
      !referencedValuationIds.includes(val.id)
    );

    console.log(`⚠️  Found ${orphanedValuations.length} orphaned valuations:`);
    for (const val of orphanedValuations) {
      console.log(`- ${val.id}: $${(val.value / 100).toFixed(2)} on ${val.asOf.toISOString().split('T')[0]}`);
    }

    if (orphanedValuations.length > 0) {
      console.log(`\n🗑️  Deleting ${orphanedValuations.length} orphaned valuations...`);

      const result = await prisma.investmentValuation.deleteMany({
        where: {
          id: {
            in: orphanedValuations.map(v => v.id)
          }
        }
      });

      console.log(`✅ Deleted ${result.count} orphaned valuations`);
    } else {
      console.log(`✅ No orphaned valuations found`);
    }

  } catch (error) {
    console.error('❌ Error during cleanup:', error);
  } finally {
    await prisma.$disconnect();
  }
}

cleanupOrphanedValuations();