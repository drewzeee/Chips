import { prisma } from './src/lib/prisma';

async function cleanupRecentIncorrect() {
  console.log('🧹 Cleaning Up Recent Incorrect Valuations');
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
        account: true
      }
    });

    if (!iraAccount) {
      throw new Error("Traditional IRA not found");
    }

    // Get recent valuations (last 30 days)
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 30);

    const recentValuations = await prisma.investmentValuation.findMany({
      where: {
        userId: user.id,
        investmentAccountId: iraAccount.id,
        asOf: {
          gte: cutoffDate
        }
      },
      orderBy: { asOf: "desc" }
    });

    console.log(`📊 Found ${recentValuations.length} recent valuations (last 30 days):`);
    for (const val of recentValuations) {
      console.log(`   ${val.asOf.toISOString().split('T')[0]}: $${(val.value / 100).toLocaleString()}`);
    }

    // Define reasonable range for current valuations
    const expectedValue = 4260153; // $42,601.53 in cents
    const reasonableLower = 4000000; // $40,000 - should be at least this much
    const reasonableUpper = 5000000; // $50,000 - shouldn't exceed this much

    const incorrectRecent = recentValuations.filter(val =>
      val.value < reasonableLower || val.value > reasonableUpper
    );

    console.log(`\n⚠️  Found ${incorrectRecent.length} recent incorrect valuations:`);
    for (const val of incorrectRecent) {
      console.log(`   ${val.asOf.toISOString().split('T')[0]}: $${(val.value / 100).toLocaleString()} (should be ~$42,601)`);
    }

    if (incorrectRecent.length > 0) {
      console.log(`\n🗑️  Removing ${incorrectRecent.length} recent incorrect valuations...`);

      // Get associated transactions
      const associatedTransactions = await prisma.transaction.findMany({
        where: {
          reference: {
            in: incorrectRecent.map(val => `investment_valuation_${val.id}`)
          }
        }
      });

      console.log(`💸 Found ${associatedTransactions.length} associated transactions`);

      // Remove transactions first
      if (associatedTransactions.length > 0) {
        await prisma.transaction.deleteMany({
          where: {
            id: {
              in: associatedTransactions.map(tx => tx.id)
            }
          }
        });
        console.log(`✅ Deleted ${associatedTransactions.length} transactions`);
      }

      // Remove valuations
      await prisma.investmentValuation.deleteMany({
        where: {
          id: {
            in: incorrectRecent.map(val => val.id)
          }
        }
      });
      console.log(`✅ Deleted ${incorrectRecent.length} incorrect valuations`);

      // Show what's left
      const remainingRecent = await prisma.investmentValuation.findMany({
        where: {
          userId: user.id,
          investmentAccountId: iraAccount.id,
          asOf: {
            gte: cutoffDate
          }
        },
        orderBy: { asOf: "desc" }
      });

      console.log(`\n📊 Remaining recent valuations: ${remainingRecent.length}`);
      for (const val of remainingRecent) {
        console.log(`   ${val.asOf.toISOString().split('T')[0]}: $${(val.value / 100).toLocaleString()}`);
      }

      if (remainingRecent.length === 0) {
        console.log(`✨ No recent valuations remain - next automated run will create correct one`);
      }

    } else {
      console.log(`✅ All recent valuations are in reasonable range`);
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

cleanupRecentIncorrect();