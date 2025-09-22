import { prisma } from "./src/lib/prisma";

async function checkHistoricalData() {
  console.log("Checking for historical data patterns...\n");

  // Check all investment valuations
  const allValuations = await prisma.investmentValuation.findMany({
    orderBy: { asOf: 'asc' },
    include: {
      account: {
        include: {
          account: true
        }
      }
    }
  });

  console.log(`Total investment valuations in database: ${allValuations.length}`);

  if (allValuations.length > 0) {
    const firstDate = allValuations[0].asOf;
    const lastDate = allValuations[allValuations.length - 1].asOf;
    console.log(`Date range: ${firstDate.toISOString().split('T')[0]} to ${lastDate.toISOString().split('T')[0]}`);
  }

  // Check 2024 data specifically
  const valuations2024 = allValuations.filter(v =>
    v.asOf >= new Date('2024-01-01') && v.asOf <= new Date('2024-12-31')
  );

  console.log(`\nValuations in 2024: ${valuations2024.length}`);

  // Check if there are regular financial accounts with substantial balances
  const accounts = await prisma.financialAccount.findMany({
    include: {
      transactions: {
        where: {
          date: {
            gte: new Date('2024-04-01'),
            lte: new Date('2024-09-30')
          }
        },
        orderBy: { date: 'asc' }
      },
      investment: true
    }
  });

  console.log(`\nTotal financial accounts: ${accounts.length}`);

  // Calculate account balances over time for April-September 2024
  console.log("\nAccount balances progression (April-September 2024):");
  console.log("===================================================");

  for (const account of accounts) {
    if (account.transactions.length > 0) {
      console.log(`\n${account.name} (${account.type}):`);

      let runningBalance = account.openingBalance;
      let lastDate = '2024-04-01';

      // Show opening balance
      console.log(`  2024-04-01: $${(runningBalance / 100).toLocaleString()}`);

      // Track monthly snapshots
      const monthlyBalances = new Map<string, number>();

      for (const tx of account.transactions) {
        runningBalance += tx.amount;
        const txDate = tx.date.toISOString().split('T')[0];
        const monthKey = txDate.substring(0, 7); // YYYY-MM format

        // Store the latest balance for each month
        monthlyBalances.set(monthKey, runningBalance);
      }

      // Show monthly progressions
      const months = ['2024-04', '2024-05', '2024-06', '2024-07', '2024-08', '2024-09'];
      for (const month of months) {
        const balance = monthlyBalances.get(month);
        if (balance !== undefined) {
          console.log(`  ${month}-30: $${(balance / 100).toLocaleString()}`);
        }
      }
    }
  }

  // Look for large single transactions that might explain the drop
  console.log("\n\nLarge transactions (>$10k) April-September 2024:");
  console.log("================================================");

  const largeTransactions = await prisma.transaction.findMany({
    where: {
      date: {
        gte: new Date('2024-04-01'),
        lte: new Date('2024-09-30')
      },
      OR: [
        { amount: { lte: -10000 } }, // Large outflows
        { amount: { gte: 10000 } }   // Large inflows
      ]
    },
    include: {
      account: true
    },
    orderBy: { date: 'asc' }
  });

  for (const tx of largeTransactions) {
    const amount = tx.amount / 100;
    console.log(`${tx.date.toISOString().split('T')[0]}: ${amount >= 0 ? '+' : ''}$${amount.toLocaleString()} - ${tx.account.name} - ${tx.merchant || tx.reference || 'No description'}`);
  }

  await prisma.$disconnect();
}

checkHistoricalData().catch(console.error);