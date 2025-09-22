import { prisma } from "./src/lib/prisma";

async function analyzeNetWorthDecline() {
  console.log("Analyzing net worth decline from April to September...\n");

  // Get investment valuations from April onwards
  const investmentValuations = await prisma.investmentValuation.findMany({
    where: {
      asOf: {
        gte: new Date('2024-04-01'),
      }
    },
    include: {
      account: {
        include: {
          account: true
        }
      }
    },
    orderBy: { asOf: 'asc' }
  });

  console.log(`Found ${investmentValuations.length} investment valuations since April 1st\n`);

  // Group by date and sum values
  const dateValueMap = new Map<string, number>();

  for (const valuation of investmentValuations) {
    const dateKey = valuation.asOf.toISOString().split('T')[0];
    const currentTotal = dateValueMap.get(dateKey) || 0;
    dateValueMap.set(dateKey, currentTotal + (valuation.value / 100));
  }

  // Show progression
  console.log("Investment Account Values Over Time:");
  console.log("===================================");
  const sortedDates = Array.from(dateValueMap.keys()).sort();

  for (const date of sortedDates) {
    const value = dateValueMap.get(date)!;
    console.log(`${date}: $${value.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`);
  }

  // Get largest decreases
  console.log("\nLargest day-to-day decreases:");
  console.log("=============================");
  const decreases: Array<{date: string, decrease: number, prevValue: number, newValue: number}> = [];

  for (let i = 1; i < sortedDates.length; i++) {
    const prevDate = sortedDates[i-1];
    const currDate = sortedDates[i];
    const prevValue = dateValueMap.get(prevDate)!;
    const currValue = dateValueMap.get(currDate)!;
    const decrease = prevValue - currValue;

    if (decrease > 0) {
      decreases.push({
        date: currDate,
        decrease,
        prevValue,
        newValue: currValue
      });
    }
  }

  decreases.sort((a, b) => b.decrease - a.decrease);
  decreases.slice(0, 10).forEach(item => {
    console.log(`${item.date}: -$${item.decrease.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} (${item.prevValue.toLocaleString()} → ${item.newValue.toLocaleString()})`);
  });

  // Check for large withdrawals or transfers
  console.log("\nChecking for large transactions in this period...");
  console.log("================================================");

  const largeTransactions = await prisma.transaction.findMany({
    where: {
      date: {
        gte: new Date('2024-04-01'),
      },
      OR: [
        { amount: { lte: -50000 } }, // Large withdrawals (in cents)
        { amount: { gte: 50000 } }   // Large deposits
      ]
    },
    include: {
      account: true
    },
    orderBy: { date: 'asc' }
  });

  largeTransactions.forEach(tx => {
    const amount = tx.amount / 100;
    console.log(`${tx.date.toISOString().split('T')[0]}: ${amount >= 0 ? '+' : ''}$${amount.toLocaleString()} - ${tx.account.name} - ${tx.merchant || tx.reference || 'N/A'}`);
  });

  // Check investment transactions for large sells
  console.log("\nChecking investment transactions...");
  console.log("===================================");

  const investmentTxs = await prisma.investmentTransaction.findMany({
    where: {
      occurredAt: {
        gte: new Date('2024-04-01'),
      },
      type: 'SELL'
    },
    include: {
      asset: true,
      account: {
        include: {
          account: true
        }
      }
    },
    orderBy: { occurredAt: 'asc' }
  });

  investmentTxs.forEach(tx => {
    const amount = tx.amount / 100;
    console.log(`${tx.occurredAt.toISOString().split('T')[0]}: SELL ${tx.quantity} ${tx.asset?.symbol || 'N/A'} for $${amount.toLocaleString()} - ${tx.account.account.name}`);
  });

  await prisma.$disconnect();
}

analyzeNetWorthDecline().catch(console.error);