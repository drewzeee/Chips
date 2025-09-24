import "dotenv/config";
import { PrismaClient } from "@/generated/prisma";

const prisma = new PrismaClient();

(async () => {
  console.log("🔍 Analyzing Traditional IRA composition...\n");

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
          orderBy: { occurredAt: "desc" }
        },
        assets: true,
        valuations: {
          orderBy: { asOf: "desc" },
          take: 5
        }
      }
    });

    if (!iraAccount) {
      throw new Error("Traditional IRA not found");
    }

    console.log(`🏦 Account: ${iraAccount.account.name}`);
    console.log(`   Opening Balance: $${(iraAccount.account.openingBalance / 100).toLocaleString()}`);

    // Get all transactions (including cash movements)
    const transactions = await prisma.transaction.findMany({
      where: {
        userId: user.id,
        accountId: iraAccount.account.id
      },
      orderBy: { date: "desc" }
    });

    console.log(`\n💳 Total Transactions: ${transactions.length}`);

    // Calculate current cash balance from transactions
    let currentBalance = iraAccount.account.openingBalance;
    for (const tx of transactions) {
      currentBalance += tx.amount;
    }

    console.log(`💰 Current Account Balance (Cash + Equity): $${(currentBalance / 100).toLocaleString()}`);

    // Analyze trades to see what equities are held
    console.log(`\n📈 Investment Trades: ${iraAccount.trades.length}`);

    const positionMap = new Map<string, { quantity: number; symbol: string; assetType: string }>();

    for (const trade of iraAccount.trades) {
      if (!trade.symbol || !trade.assetType) continue;

      const symbol = trade.symbol.toUpperCase();
      const quantity = Number(trade.quantity || 0);
      const assetType = trade.assetType;
      const key = `${symbol}_${assetType}`;

      if (trade.type === "BUY") {
        const current = positionMap.get(key) || { quantity: 0, symbol, assetType };
        positionMap.set(key, { ...current, quantity: current.quantity + quantity });
      } else if (trade.type === "SELL") {
        const current = positionMap.get(key) || { quantity: 0, symbol, assetType };
        positionMap.set(key, { ...current, quantity: current.quantity - quantity });
      }
    }

    // Show current equity positions
    console.log(`\n📊 Current Equity Positions:`);
    let totalEquityInvested = 0;

    for (const [key, position] of positionMap) {
      if (position.quantity > 0) {
        console.log(`   ${position.symbol} (${position.assetType}): ${position.quantity} shares`);

        // Calculate approximate invested amount from trades
        const relatedTrades = iraAccount.trades.filter(t =>
          t.symbol === position.symbol && t.assetType === position.assetType
        );

        let investedAmount = 0;
        for (const trade of relatedTrades) {
          const tradeValue = Number(trade.amount || 0);
          if (trade.type === "BUY") {
            investedAmount += tradeValue;
          } else if (trade.type === "SELL") {
            investedAmount -= tradeValue;
          }
        }

        totalEquityInvested += investedAmount;
        console.log(`     Invested: $${(investedAmount / 100).toLocaleString()}`);
      }
    }

    const estimatedCashBalance = currentBalance - totalEquityInvested;

    console.log(`\n💡 Analysis:`);
    console.log(`   Total Account Balance: $${(currentBalance / 100).toLocaleString()}`);
    console.log(`   Invested in Equities: $${(totalEquityInvested / 100).toLocaleString()}`);
    console.log(`   Estimated Cash Balance: $${(estimatedCashBalance / 100).toLocaleString()}`);

    // Show recent valuations
    console.log(`\n📊 Recent Valuations:`);
    for (const val of iraAccount.valuations) {
      console.log(`   ${val.asOf.toISOString().split('T')[0]}: $${(val.value / 100).toLocaleString()}`);
    }

    // Compare automated valuation logic
    console.log(`\n🤖 Automated Valuation Logic Analysis:`);
    console.log(`   Only counts trades with type="BUY" or "SELL" AND symbol is not null`);
    console.log(`   Ignores cash deposits/withdrawals (transactions without symbol)`);
    console.log(`   Would only value equity positions at current market prices`);
    console.log(`   Missing: Cash holdings that aren't invested in securities`);

    const activePositions = Array.from(positionMap.values()).filter(p => p.quantity > 0);
    if (activePositions.length === 0) {
      console.log(`\n⚠️  ISSUE CONFIRMED: No active equity positions found!`);
      console.log(`     The automated valuation system would assign $0 value`);
      console.log(`     But the account has $${(estimatedCashBalance / 100).toLocaleString()} in cash`);
    } else {
      console.log(`\n✅ Active positions found: ${activePositions.length} securities`);
    }

  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    await prisma.$disconnect();
  }
})();