import { prisma } from "./src/lib/prisma";

async function debugDashboardVsReports() {
  console.log("=== DEBUGGING DASHBOARD VS REPORTS DISCREPANCY ===\n");

  // Simulate dashboard API logic
  console.log("1. DASHBOARD API LOGIC:");
  console.log("======================");

  const accounts = await prisma.financialAccount.findMany({
    where: { userId: "user_2nTu6kpBvUgK2IZaOJvShOQKz6u" }, // Replace with actual user ID
    include: {
      investment: true,
      transactions: { orderBy: { date: "asc" } }
    }
  });

  const investmentValuations = await prisma.investmentValuation.findMany({
    where: { userId: "user_2nTu6kpBvUgK2IZaOJvShOQKz6u" },
    orderBy: { asOf: "asc" }
  });

  console.log(`Found ${investmentValuations.length} investment valuations`);
  console.log(`Date range: ${investmentValuations[0]?.asOf.toISOString().split('T')[0]} to ${investmentValuations[investmentValuations.length - 1]?.asOf.toISOString().split('T')[0]}`);

  // The bug: allDates only contains investment valuation dates
  const allDates = Array.from(new Set(investmentValuations.map(v => v.asOf.toISOString().split('T')[0]))).sort();
  console.log(`\nDashboard API only processes these dates: ${allDates.join(', ')}`);
  console.log("^^ THIS IS THE BUG! No 2024 dates means no traditional account calculations for 2024");

  // Now simulate reports API logic
  console.log("\n2. REPORTS API LOGIC:");
  console.log("======================");

  // Reports API generates monthly intervals regardless of investment data
  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - 12);

  console.log(`Reports API processes ALL months from ${startDate.toISOString().split('T')[0]} to present`);
  console.log("This includes 2024 months even when no investment valuations exist");

  // Check traditional account balances for April 2024
  console.log("\n3. TRADITIONAL ACCOUNT BALANCES IN APRIL 2024:");
  console.log("===============================================");

  const april2024End = new Date('2024-04-30T23:59:59.999Z');

  for (const account of accounts) {
    if (!account.investment) {
      const relevantTransactions = account.transactions.filter(tx => tx.date <= april2024End);
      const transactionSum = relevantTransactions.reduce((sum, tx) => sum + tx.amount, 0);
      const accountBalance = account.openingBalance + transactionSum;
      console.log(`${account.name}: $${(accountBalance / 100).toLocaleString()}`);
    }
  }

  // Check September 2024
  console.log("\n4. TRADITIONAL ACCOUNT BALANCES IN SEPTEMBER 2024:");
  console.log("===================================================");

  const sept2024End = new Date('2024-09-30T23:59:59.999Z');

  for (const account of accounts) {
    if (!account.investment) {
      const relevantTransactions = account.transactions.filter(tx => tx.date <= sept2024End);
      const transactionSum = relevantTransactions.reduce((sum, tx) => sum + tx.amount, 0);
      const accountBalance = account.openingBalance + transactionSum;
      console.log(`${account.name}: $${(accountBalance / 100).toLocaleString()}`);
    }
  }

  console.log("\n5. CONCLUSION:");
  console.log("===============");
  console.log("- Dashboard API: Only shows data for dates with investment valuations (Sept 2025 only)");
  console.log("- Reports API: Shows data for ALL months, including 2024");
  console.log("- The $91k 'decrease' is actually missing historical data, not a real decrease");

  await prisma.$disconnect();
}

debugDashboardVsReports().catch(console.error);