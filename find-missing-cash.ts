import "dotenv/config";
import { PrismaClient } from "@/generated/prisma";

const prisma = new PrismaClient();

(async () => {
  console.log("🕵️ Hunting for the missing $15,189.51...\n");

  try {
    const user = await prisma.user.findFirst();
    if (!user) {
      throw new Error("No user found");
    }

    // Find Traditional IRA
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

    // Look for any investment assets in this account
    const investmentAssets = await prisma.investmentAsset.findMany({
      where: {
        userId: user.id,
        investmentAccountId: iraAccount.id
      },
      include: {
        valuations: {
          orderBy: { asOf: "desc" },
          take: 5
        }
      }
    });

    console.log(`\n💎 Investment Assets in Traditional IRA: ${investmentAssets.length}`);
    let totalAssetValue = 0;

    for (const asset of investmentAssets) {
      console.log(`   ${asset.name} (${asset.type}): ${asset.symbol || 'No symbol'}`);
      console.log(`     Created: ${asset.createdAt.toISOString().split('T')[0]}`);

      if (asset.valuations.length > 0) {
        console.log(`     Recent valuations:`);
        for (const val of asset.valuations) {
          console.log(`       ${val.asOf.toISOString().split('T')[0]}: $${(val.value / 100).toLocaleString()}`);
        }
        totalAssetValue += asset.valuations[0].value;
      }
    }

    console.log(`\n💰 Total Asset Values: $${(totalAssetValue / 100).toLocaleString()}`);

    // Look for any asset valuations with the missing amount
    const targetAmount = 1518951; // $15,189.51 in cents
    const possibleCashValuations = await prisma.investmentAssetValuation.findMany({
      where: {
        userId: user.id,
        value: targetAmount
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

    console.log(`\n💵 Asset valuations matching $15,189.51: ${possibleCashValuations.length}`);
    for (const val of possibleCashValuations) {
      console.log(`   ${val.asset.name} in ${val.asset.account.account.name}`);
      console.log(`   Date: ${val.asOf.toISOString().split('T')[0]}`);
      console.log(`   Asset type: ${val.asset.type}`);
    }

    // Look for valuations close to the total we expect ($42,601.53)
    const expectedTotal = 4260153; // $42,601.53 in cents
    const tolerance = 100; // $1 tolerance

    const closeValuations = await prisma.investmentValuation.findMany({
      where: {
        userId: user.id,
        value: {
          gte: expectedTotal - tolerance,
          lte: expectedTotal + tolerance
        }
      },
      include: {
        account: {
          include: {
            account: true
          }
        }
      }
    });

    console.log(`\n🎯 Investment valuations near $42,601.53: ${closeValuations.length}`);
    for (const val of closeValuations) {
      console.log(`   ${val.account.account.name}: ${val.asOf.toISOString().split('T')[0]} = $${(val.value / 100).toLocaleString()}`);
    }

    // Check if there are multiple investment accounts for Traditional IRA
    const allIRAAccounts = await prisma.investmentAccount.findMany({
      where: {
        userId: user.id,
        account: {
          name: { contains: "IRA", mode: "insensitive" }
        }
      },
      include: {
        account: true,
        valuations: {
          orderBy: { asOf: "desc" },
          take: 1
        }
      }
    });

    console.log(`\n📊 All IRA-related accounts: ${allIRAAccounts.length}`);
    for (const account of allIRAAccounts) {
      console.log(`   ${account.account.name} (${account.id.slice(-8)})`);
      if (account.valuations.length > 0) {
        console.log(`     Latest valuation: $${(account.valuations[0].value / 100).toLocaleString()}`);
      }
    }

    // Calculate what the UI might be showing by combining different sources
    console.log(`\n🔍 Possible UI Calculation:`);
    console.log(`   Account Balance: $27,412.02`);
    console.log(`   Asset Valuations: $${(totalAssetValue / 100).toLocaleString()}`);
    console.log(`   Expected Total: $42,601.53`);
    console.log(`   Missing: $${((4260153 - 2741202 - totalAssetValue) / 100).toLocaleString()}`);

  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    await prisma.$disconnect();
  }
})();