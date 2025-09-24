import { prisma } from './src/lib/prisma';

async function verifyCleanup() {
  console.log('✅ Verifying Valuation Cleanup');
  console.log('=' .repeat(35));

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
        account: true
      }
    });

    if (!iraAccount) {
      throw new Error("Traditional IRA not found");
    }

    // Get all remaining valuations
    const allValuations = await prisma.investmentValuation.findMany({
      where: {
        userId: user.id,
        investmentAccountId: iraAccount.id
      },
      orderBy: { asOf: "desc" }
    });

    console.log(`📊 Total remaining valuations: ${allValuations.length}`);

    // Show latest 10 valuations
    console.log(`\n📈 Latest 10 valuations:`);
    for (const val of allValuations.slice(0, 10)) {
      console.log(`   ${val.asOf.toISOString().split('T')[0]}: $${(val.value / 100).toLocaleString()}`);
    }

    // Check for any valuations that might still be problematic
    const suspiciousLow = allValuations.filter(val => val.value < 3000000); // Less than $30k
    const suspiciousHigh = allValuations.filter(val => val.value > 6000000); // More than $60k

    console.log(`\n🔍 Quality Check:`);
    console.log(`   Suspiciously low values (< $30k): ${suspiciousLow.length}`);
    console.log(`   Suspiciously high values (> $60k): ${suspiciousHigh.length}`);

    if (suspiciousLow.length > 0) {
      console.log(`   📉 Low values found:`);
      for (const val of suspiciousLow.slice(0, 5)) {
        console.log(`     ${val.asOf.toISOString().split('T')[0]}: $${(val.value / 100).toLocaleString()}`);
      }
    }

    if (suspiciousHigh.length > 0) {
      console.log(`   📈 High values found:`);
      for (const val of suspiciousHigh.slice(0, 5)) {
        console.log(`     ${val.asOf.toISOString().split('T')[0]}: $${(val.value / 100).toLocaleString()}`);
      }
    }

    // Check that we don't have any orphaned valuation transactions
    const orphanedTxs = await prisma.transaction.findMany({
      where: {
        userId: user.id,
        accountId: iraAccount.account.id,
        reference: {
          startsWith: 'investment_valuation_'
        }
      }
    });

    const validReferences = allValuations.map(val => `investment_valuation_${val.id}`);
    const actualOrphans = orphanedTxs.filter(tx =>
      !validReferences.includes(tx.reference || '')
    );

    console.log(`\n🔧 Orphaned transaction check:`);
    console.log(`   Total valuation transactions: ${orphanedTxs.length}`);
    console.log(`   Orphaned transactions: ${actualOrphans.length}`);

    // Summary
    const reasonableCount = allValuations.filter(val =>
      val.value >= 3000000 && val.value <= 6000000
    ).length;

    console.log(`\n📋 Summary:`);
    console.log(`   ✅ Reasonable valuations ($30k-$60k): ${reasonableCount}/${allValuations.length}`);
    console.log(`   🧹 Cleanup removed: 172 incorrect valuations + transactions`);
    console.log(`   🎯 Next automated run should create correct ~$42,601.53 valuation`);

    if (suspiciousLow.length === 0 && suspiciousHigh.length === 0 && actualOrphans.length === 0) {
      console.log(`\n🎉 Database is clean! All remaining valuations look reasonable.`);
    } else {
      console.log(`\n⚠️  Some issues may remain - consider additional cleanup if needed.`);
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

verifyCleanup();