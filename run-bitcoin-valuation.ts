import "dotenv/config";
import { PrismaClient } from "@/generated/prisma";
import { fetchCryptoPrices } from "@/lib/crypto-prices";

const prisma = new PrismaClient();

(async () => {
  console.log("🔄 Running Bitcoin valuation mechanism...\n");

  try {
    // Get current Bitcoin price
    console.log("📊 Fetching current Bitcoin price...");
    const prices = await fetchCryptoPrices(["BTC"]);
    const btcPrice = prices["BTC"];

    if (!btcPrice) {
      throw new Error("Could not fetch Bitcoin price");
    }

    console.log(`Current BTC price: $${btcPrice.toLocaleString()}\n`);

    // Find the user and their Bitcoin investment transaction
    const user = await prisma.user.findFirst();
    if (!user) {
      throw new Error("No user found");
    }

    console.log(`👤 User: ${user.email}`);

    // Find Bitcoin investment transaction
    const bitcoinTx = await prisma.investmentTransaction.findFirst({
      where: {
        userId: user.id,
        symbol: { contains: "BTC", mode: "insensitive" }
      },
      include: {
        account: {
          include: {
            account: true
          }
        },
        asset: true
      }
    });

    if (!bitcoinTx) {
      throw new Error("No Bitcoin transaction found");
    }

    console.log(`\n₿ Found Bitcoin transaction:`);
    console.log(`   ${bitcoinTx.type}: ${bitcoinTx.quantity} BTC @ $${Number(bitcoinTx.pricePerUnit).toLocaleString()}`);
    console.log(`   Original value: $${(bitcoinTx.amount / 100).toLocaleString()}`);
    console.log(`   Account: ${bitcoinTx.account.account.name}`);

    // Calculate current value
    const quantity = Number(bitcoinTx.quantity);
    const currentValue = quantity * btcPrice;
    const currentValueCents = Math.round(currentValue * 100);

    console.log(`\n💰 Current valuation:`);
    console.log(`   ${quantity} BTC × $${btcPrice.toLocaleString()} = $${currentValue.toLocaleString()}`);
    console.log(`   Gain/Loss: $${(currentValue - (bitcoinTx.amount / 100)).toLocaleString()}`);

    // Create/update investment account valuation
    const investmentAccountId = bitcoinTx.account.id;
    const financialAccountId = bitcoinTx.account.account.id;
    const asOf = new Date();

    console.log(`\n🔄 Updating investment account valuation...`);

    const result = await prisma.$transaction(async (tx) => {
      // Calculate total current value of the investment account
      // For simplicity, assuming this is the only asset, but in practice you'd sum all assets

      // Upsert the investment valuation
      const valuation = await tx.investmentValuation.upsert({
        where: {
          investmentAccountId_asOf: {
            investmentAccountId,
            asOf
          }
        },
        update: {
          value: currentValueCents
        },
        create: {
          userId: user.id,
          investmentAccountId,
          value: currentValueCents,
          asOf
        }
      });

      // Calculate the difference between current book value and market value
      const openingBalance = bitcoinTx.account.account.openingBalance;

      // Get sum of all transactions in this account up to the valuation date
      const totals = await tx.transaction.aggregate({
        where: {
          userId: user.id,
          accountId: financialAccountId,
          date: {
            lte: asOf
          }
        },
        _sum: { amount: true }
      });

      const bookValue = openingBalance + (totals._sum.amount ?? 0);
      const difference = currentValueCents - bookValue;

      console.log(`   Book value: $${(bookValue / 100).toLocaleString()}`);
      console.log(`   Market value: $${(currentValueCents / 100).toLocaleString()}`);
      console.log(`   Adjustment needed: $${(difference / 100).toLocaleString()}`);

      // Create or update the valuation adjustment transaction
      const reference = `investment_valuation_${valuation.id}`;

      const existingAdjustment = await tx.transaction.findFirst({
        where: {
          userId: user.id,
          accountId: financialAccountId,
          reference
        }
      });

      const newAmount = (existingAdjustment?.amount ?? 0) + difference;

      if (existingAdjustment) {
        if (newAmount === 0) {
          await tx.transaction.delete({ where: { id: existingAdjustment.id } });
          console.log(`   ✅ Removed zero adjustment transaction`);
        } else {
          await tx.transaction.update({
            where: { id: existingAdjustment.id },
            data: {
              amount: newAmount,
              date: asOf
            }
          });
          console.log(`   ✅ Updated adjustment transaction: $${(newAmount / 100).toLocaleString()}`);
        }
      } else if (difference !== 0) {
        await tx.transaction.create({
          data: {
            userId: user.id,
            accountId: financialAccountId,
            date: asOf,
            amount: difference,
            description: "Valuation Adjustment",
            status: "CLEARED",
            reference
          }
        });
        console.log(`   ✅ Created new adjustment transaction: $${(difference / 100).toLocaleString()}`);
      }

      return valuation;
    });

    console.log(`\n✅ Valuation mechanism completed successfully!`);
    console.log(`   Valuation ID: ${result.id}`);
    console.log(`   As of: ${result.asOf.toISOString()}`);

  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    await prisma.$disconnect();
  }
})();