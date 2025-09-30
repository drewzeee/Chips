import "dotenv/config";
import { PrismaClient } from "@/generated/prisma";

const prisma = new PrismaClient();

(async () => {
  console.log("🔍 Deep dive into cash tracking system...\n");

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

    console.log(`🏦 Traditional IRA Account ID: ${iraAccount.id}`);
    console.log(`   Financial Account ID: ${iraAccount.accountId}`);

    // Check if there are separate investment assets for this account
    const allInvestmentAssets = await prisma.investmentAsset.findMany({
      where: {
        userId: user.id,
        investmentAccountId: iraAccount.id
      },
      include: {
        valuations: {
          orderBy: { asOf: "desc" },
          take: 3
        }
      }
    });

    console.log(`\n💎 Investment Assets for this account: ${allInvestmentAssets.length}`);
    for (const asset of allInvestmentAssets) {
      console.log(`   ${asset.name} (${asset.type}): ${asset.symbol || 'No symbol'}`);
      console.log(`     Created: ${asset.createdAt.toISOString().split('T')[0]}`);
      if (asset.valuations.length > 0) {
        console.log(`     Latest valuations:`);
        for (const val of asset.valuations) {
          console.log(`       ${val.asOf.toISOString().split('T')[0]}: $${(val.value / 100).toLocaleString()}`);
        }
      }
    }

    // Look for any cash assets across ALL investment accounts for this user
    const allCashAssets = await prisma.investmentAsset.findMany({
      where: {
        userId: user.id,
        OR: [
          { symbol: 'USD' },
          { name: { contains: 'cash', mode: 'insensitive' } },
          { name: { contains: 'money market', mode: 'insensitive' } }
        ]
      },
      include: {
        account: {
          include: {
            account: true
          }
        },
        valuations: {
          orderBy: { asOf: "desc" },
          take: 1
        }
      }
    });

    console.log(`\n💰 All Cash Assets (user-wide): ${allCashAssets.length}`);
    for (const asset of allCashAssets) {
      console.log(`   ${asset.name} in ${asset.account.account.name}`);
      console.log(`     Type: ${asset.type}, Symbol: ${asset.symbol || 'None'}`);
      if (asset.valuations.length > 0) {
        console.log(`     Current value: $${(asset.valuations[0].value / 100).toLocaleString()}`);
      }
    }

    // Check the financial account structure - maybe cash is at the account level
    console.log(`\n🏛️ Financial Account Structure:`);
    const financialAccount = await prisma.financialAccount.findUnique({
      where: { id: iraAccount.accountId },
      include: {
        transactions: {
          orderBy: { date: "desc" },
          take: 10
        }
      }
    });

    if (financialAccount) {
      console.log(`   Account Name: ${financialAccount.name}`);
      console.log(`   Type: ${financialAccount.type}`);
      console.log(`   Opening Balance: $${(financialAccount.openingBalance / 100).toLocaleString()}`);

      // Calculate current balance
      let currentBalance = financialAccount.openingBalance;
      const allTxs = await prisma.transaction.findMany({
        where: { accountId: financialAccount.id }
      });

      for (const tx of allTxs) {
        currentBalance += tx.amount;
      }

      console.log(`   Current Balance: $${(currentBalance / 100).toLocaleString()}`);
    }

    // Now let's see what the UI might be showing - check for $42,601.53
    const targetValue = 4260153; // $42,601.53 in cents

    // Look for any valuation that matches this amount
    const matchingValuations = await prisma.investmentValuation.findMany({
      where: {
        userId: user.id,
        value: targetValue
      },
      include: {
        account: {
          include: {
            account: true
          }
        }
      }
    });

    console.log(`\n🎯 Valuations matching $42,601.53: ${matchingValuations.length}`);
    for (const val of matchingValuations) {
      console.log(`   ${val.account.account.name}: ${val.asOf.toISOString().split('T')[0]} = $${(val.value / 100).toLocaleString()}`);
    }

    // Look for asset valuations that might match
    const matchingAssetValuations = await prisma.investmentAssetValuation.findMany({
      where: {
        userId: user.id,
        value: targetValue
      },
      include: {
        asset: {
          include: {
            account: {
              include: {
                account: true
              }
            }
          }
        }
      }
    });

    console.log(`\n💎 Asset valuations matching $42,601.53: ${matchingAssetValuations.length}`);
    for (const val of matchingAssetValuations) {
      console.log(`   ${val.asset.name} in ${val.asset.account.account.name}: ${val.asOf.toISOString().split('T')[0]} = $${(val.value / 100).toLocaleString()}`);
    }

    // Look for the $15,189.51 cash amount
    const cashAmount = 1518951; // $15,189.51 in cents

    const matchingCashValuations = await prisma.investmentAssetValuation.findMany({
      where: {
        userId: user.id,
        value: cashAmount
      },
      include: {
        asset: {
          include: {
            account: {
              include: {
                account: true
              }
            }
          }
        }
      }
    });

    console.log(`\n💵 Asset valuations matching $15,189.51: ${matchingCashValuations.length}`);
    for (const val of matchingCashValuations) {
      console.log(`   ${val.asset.name} in ${val.asset.account.account.name}: ${val.asOf.toISOString().split('T')[0]} = $${(val.value / 100).toLocaleString()}`);
    }

  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    await prisma.$disconnect();
  }
})();