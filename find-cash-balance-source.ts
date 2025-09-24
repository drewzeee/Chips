import "dotenv/config";
import { PrismaClient } from "@/generated/prisma";

const prisma = new PrismaClient();

(async () => {
  console.log("🔍 Finding source of $15,189.51 cash balance...\n");

  try {
    const user = await prisma.user.findFirst();
    if (!user) {
      throw new Error("No user found");
    }

    const iraAccount = await prisma.investmentAccount.findFirst({
      where: {
        userId: user.id,
        account: {
          name: { contains: "Traditional IRA", mode: "insensitive" }
        }
      },
      include: {
        account: true,
        assets: {
          include: {
            valuations: {
              orderBy: { asOf: "desc" },
              take: 1
            }
          }
        }
      }
    });

    if (!iraAccount) {
      throw new Error("Traditional IRA not found");
    }

    // Look for cash as an investment asset
    const cashAmount = 1518951; // $15,189.51 in cents
    const tolerance = 100; // $1 tolerance

    console.log(`💰 Searching for cash balance of $15,189.51...\n`);

    // Check if cash is stored as an investment asset
    const allAssets = await prisma.investmentAsset.findMany({
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

    console.log(`📊 Investment Assets in Traditional IRA: ${allAssets.length}`);
    for (const asset of allAssets) {
      console.log(`   ${asset.name} (${asset.type}): ${asset.symbol || 'No symbol'}`);
      if (asset.valuations.length > 0) {
        console.log(`     Latest value: $${(asset.valuations[0].value / 100).toLocaleString()}`);
        if (Math.abs(asset.valuations[0].value - cashAmount) < tolerance) {
          console.log(`     🎯 FOUND CASH MATCH!`);
        }
      }
    }

    // Look for any asset valuations that match the cash amount
    const cashValuations = await prisma.investmentAssetValuation.findMany({
      where: {
        userId: user.id,
        value: {
          gte: cashAmount - tolerance,
          lte: cashAmount + tolerance
        }
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
      },
      orderBy: { asOf: "desc" }
    });

    console.log(`\n💵 Asset valuations near $15,189.51: ${cashValuations.length}`);
    for (const val of cashValuations) {
      console.log(`   ${val.asset.name} in ${val.asset.account.account.name}`);
      console.log(`     Value: $${(val.value / 100).toLocaleString()}`);
      console.log(`     Date: ${val.asOf.toISOString().split('T')[0]}`);
      console.log(`     Asset Type: ${val.asset.type}`);
      console.log(`     Asset Symbol: ${val.asset.symbol || 'None'}`);
    }

    // Check if there's a separate cash calculation logic
    // Calculate uninvested cash from account balance minus equity investments
    const allTransactions = await prisma.transaction.findMany({
      where: {
        userId: user.id,
        accountId: iraAccount.accountId
      }
    });

    let totalBalance = iraAccount.account.openingBalance;
    for (const tx of allTransactions) {
      totalBalance += tx.amount;
    }

    // Calculate total equity investment from trades
    const allTrades = await prisma.investmentTransaction.findMany({
      where: {
        userId: user.id,
        investmentAccountId: iraAccount.id,
        type: { in: ["BUY", "SELL"] }
      }
    });

    let totalEquityInvestment = 0;
    for (const trade of allTrades) {
      if (trade.type === "BUY") {
        totalEquityInvestment += trade.amount;
      } else if (trade.type === "SELL") {
        totalEquityInvestment -= trade.amount;
      }
    }

    const calculatedCash = totalBalance - totalEquityInvestment;

    console.log(`\n🧮 Calculated Cash Position:`);
    console.log(`   Total Account Balance: $${(totalBalance / 100).toLocaleString()}`);
    console.log(`   Total Equity Investment: $${(totalEquityInvestment / 100).toLocaleString()}`);
    console.log(`   Calculated Cash: $${(calculatedCash / 100).toLocaleString()}`);

    if (Math.abs(calculatedCash - cashAmount) < tolerance) {
      console.log(`   🎯 FOUND MATCH: Calculated cash matches UI!`);
      console.log(`   📝 Cash = Account Balance - Equity Investments`);
    }

    // Look for any other patterns in the data
    console.log(`\n🔍 Additional Search Patterns:`);

    // Check if there are deposits/withdrawals that might represent cash
    const cashTransactions = await prisma.investmentTransaction.findMany({
      where: {
        userId: user.id,
        investmentAccountId: iraAccount.id,
        type: { in: ["DEPOSIT", "WITHDRAW"] }
      },
      orderBy: { occurredAt: "desc" }
    });

    console.log(`   Cash transactions (DEPOSIT/WITHDRAW): ${cashTransactions.length}`);
    for (const tx of cashTransactions) {
      console.log(`     ${tx.occurredAt.toISOString().split('T')[0]}: ${tx.type} $${((tx.amount || 0) / 100).toFixed(2)}`);
    }

  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    await prisma.$disconnect();
  }
})();