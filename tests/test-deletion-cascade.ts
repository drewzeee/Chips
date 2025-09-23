import { prisma } from '../src/lib/prisma';

async function testDeletionCascade() {
  console.log('🧪 Testing Transaction Deletion Cascade');
  console.log('=' .repeat(50));

  try {
    // Find transactions with investment trade references
    const investmentTradeTransactions = await prisma.transaction.findMany({
      where: {
        reference: {
          startsWith: 'investment_trade_'
        }
      },
      take: 5
    });

    console.log(`\n📊 Found ${investmentTradeTransactions.length} investment trade transactions`);
    for (const tx of investmentTradeTransactions) {
      console.log(`- ${tx.id}: ${tx.description} (ref: ${tx.reference})`);
    }

    // Find transactions with valuation references
    const valuationTransactions = await prisma.transaction.findMany({
      where: {
        reference: {
          startsWith: 'investment_valuation_'
        }
      },
      take: 5
    });

    console.log(`\n📈 Found ${valuationTransactions.length} valuation adjustment transactions`);
    for (const tx of valuationTransactions) {
      console.log(`- ${tx.id}: ${tx.description} (ref: ${tx.reference})`);
    }

    // Check for orphaned investment transactions
    const allInvestmentTxs = await prisma.investmentTransaction.findMany({
      select: { id: true }
    });

    const referencedInvestmentTxs = investmentTradeTransactions.map(tx =>
      tx.reference?.replace('investment_trade_', '')
    ).filter(Boolean);

    const orphanedInvestmentTxs = allInvestmentTxs.filter(tx =>
      !referencedInvestmentTxs.includes(tx.id)
    );

    console.log(`\n🔍 Analysis:`);
    console.log(`- Total investment transactions: ${allInvestmentTxs.length}`);
    console.log(`- Referenced by main transactions: ${referencedInvestmentTxs.length}`);
    console.log(`- Potentially orphaned: ${orphanedInvestmentTxs.length}`);

    if (orphanedInvestmentTxs.length > 0) {
      console.log(`\n⚠️  Orphaned investment transaction IDs:`);
      orphanedInvestmentTxs.slice(0, 5).forEach(tx => console.log(`- ${tx.id}`));
    }

    // Check for orphaned valuations
    const allValuations = await prisma.investmentValuation.findMany({
      select: { id: true }
    });

    const referencedValuations = valuationTransactions.map(tx =>
      tx.reference?.replace('investment_valuation_', '')
    ).filter(Boolean);

    const orphanedValuations = allValuations.filter(val =>
      !referencedValuations.includes(val.id)
    );

    console.log(`\n📊 Valuation Analysis:`);
    console.log(`- Total investment valuations: ${allValuations.length}`);
    console.log(`- Referenced by transactions: ${referencedValuations.length}`);
    console.log(`- Potentially orphaned: ${orphanedValuations.length}`);

    if (orphanedValuations.length > 0) {
      console.log(`\n⚠️  Orphaned valuation IDs:`);
      orphanedValuations.slice(0, 5).forEach(val => console.log(`- ${val.id}`));
    }

  } catch (error) {
    console.error('❌ Error during analysis:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testDeletionCascade();