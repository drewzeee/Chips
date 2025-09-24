import "dotenv/config";
import { PrismaClient } from "@/generated/prisma";

const prisma = new PrismaClient();

// Mock the automated valuation logic to see what it would calculate
(async () => {
  console.log("🧪 Testing what automated valuation would calculate...\n");

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
        trades: {
          where: {
            type: { in: ["BUY", "SELL"] },
            symbol: { not: null }
          },
          orderBy: { occurredAt: "desc" }
        },
        valuations: {
          orderBy: { asOf: "desc" },
          take: 1
        }
      }
    });

    if (!iraAccount) {
      throw new Error("Traditional IRA not found");
    }

    console.log(`🏦 Account: ${iraAccount.account.name}`);

    // Calculate positions exactly like the automated system would
    const positionMap = new Map<string, { quantity: number; symbol: string; assetType: 'CRYPTO' | 'EQUITY' | null }>();

    console.log(`\n📈 Processing ${iraAccount.trades.length} trades (BUY/SELL with symbols only):`);

    for (const trade of iraAccount.trades) {
      console.log(`   ${trade.occurredAt.toISOString().split('T')[0]}: ${trade.type} ${trade.quantity} ${trade.symbol} (${trade.assetType}) for $${((trade.amount || 0) / 100).toFixed(2)}`);

      if (!trade.symbol || !trade.assetType) continue;

      const symbol = trade.symbol.toUpperCase();
      const quantity = Number(trade.quantity || 0);
      const assetType = trade.assetType as 'CRYPTO' | 'EQUITY';
      const key = `${symbol}_${assetType}`;

      if (trade.type === "BUY") {
        const current = positionMap.get(key) || { quantity: 0, symbol, assetType };
        positionMap.set(key, { ...current, quantity: current.quantity + quantity });
      } else if (trade.type === "SELL") {
        const current = positionMap.get(key) || { quantity: 0, symbol, assetType };
        positionMap.set(key, { ...current, quantity: current.quantity - quantity });
      }
    }

    console.log(`\n📊 Calculated Positions:`);
    const positions = [];
    for (const [key, position] of positionMap) {
      if (position.quantity > 0 && position.assetType) {
        console.log(`   ${position.symbol} (${position.assetType}): ${position.quantity} shares`);
        positions.push(position);
      }
    }

    console.log(`\n🎯 What Automated Valuation Would Do:`);
    console.log(`   1. Find ${positions.length} active positions`);
    console.log(`   2. Fetch current market prices for: ${positions.map(p => p.symbol).join(', ')}`);
    console.log(`   3. Calculate total value as: (quantity × current_price) for each position`);
    console.log(`   4. Sum all position values = total account valuation`);

    // Get actual account balance for comparison
    const transactions = await prisma.transaction.findMany({
      where: {
        userId: user.id,
        accountId: iraAccount.account.id
      }
    });

    let actualBalance = iraAccount.account.openingBalance;
    for (const tx of transactions) {
      actualBalance += tx.amount;
    }

    console.log(`\n📊 Comparison:`);
    console.log(`   Actual Account Balance: $${(actualBalance / 100).toLocaleString()}`);
    console.log(`   Latest Automated Valuation: $${iraAccount.valuations[0] ? (iraAccount.valuations[0].value / 100).toLocaleString() : 'None'}`);

    const difference = actualBalance - (iraAccount.valuations[0]?.value || 0);
    console.log(`   Difference: $${(difference / 100).toLocaleString()}`);

    if (Math.abs(difference) > 1000) { // More than $10 difference
      console.log(`\n⚠️  SIGNIFICANT DIFFERENCE DETECTED!`);
      console.log(`     This suggests the automated valuation is missing cash holdings`);
      console.log(`     or there's a mismatch between equity valuations and account balance`);
    }

    // Show what's NOT being counted
    console.log(`\n🔍 What's NOT Being Counted in Automated Valuation:`);

    const nonTradeTransactions = await prisma.transaction.findMany({
      where: {
        userId: user.id,
        accountId: iraAccount.account.id,
        OR: [
          { reference: null },
          { reference: { not: { startsWith: 'investment_valuation_' } } }
        ]
      }
    });

    let cashMovements = 0;
    for (const tx of nonTradeTransactions) {
      // Exclude valuation adjustments
      if (!tx.reference?.startsWith('investment_valuation_')) {
        cashMovements += tx.amount;
      }
    }

    console.log(`   Cash deposits/withdrawals: $${(cashMovements / 100).toLocaleString()}`);
    console.log(`   Opening balance: $${(iraAccount.account.openingBalance / 100).toLocaleString()}`);
    console.log(`   Uninvested cash: $${((iraAccount.account.openingBalance + cashMovements - (iraAccount.trades.reduce((sum, t) => sum + (t.amount || 0), 0))) / 100).toLocaleString()}`);

  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    await prisma.$disconnect();
  }
})();