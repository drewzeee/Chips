import "dotenv/config";
import { PrismaClient } from "@/generated/prisma";
import { format, startOfMonth, endOfMonth } from "date-fns";

const prisma = new PrismaClient();

(async () => {
  console.log("🔍 Testing income/expense calculation separation...\n");

  try {
    const user = await prisma.user.findFirst();
    if (!user) {
      throw new Error("No user found");
    }

    const now = new Date();
    const monthStart = startOfMonth(now);
    const monthEnd = endOfMonth(now);

    console.log(`📊 Analyzing transactions for ${format(now, "MMMM yyyy")}`);
    console.log(`Period: ${monthStart.toDateString()} to ${monthEnd.toDateString()}\n`);

    // Get all financial accounts
    const accounts = await prisma.financialAccount.findMany({
      where: { userId: user.id },
      include: {
        investment: true
      }
    });

    console.log("🏦 Account Summary:");
    for (const account of accounts) {
      console.log(`   ${account.name} (${account.type}${account.investment ? ' - INVESTMENT' : ''})`);
    }

    // Get all transactions this month
    const allTransactions = await prisma.transaction.findMany({
      where: {
        userId: user.id,
        date: {
          gte: monthStart,
          lte: monthEnd
        }
      },
      include: {
        account: {
          include: {
            investment: true
          }
        },
        splits: {
          include: {
            category: true
          }
        }
      },
      orderBy: { date: 'desc' }
    });

    console.log(`\n💳 All Transactions This Month (${allTransactions.length}):`);

    let investmentTransactions: typeof allTransactions = [];
    let regularTransactions: typeof allTransactions = [];
    let valuationAdjustments: typeof allTransactions = [];

    for (const tx of allTransactions) {
      console.log(`   ${tx.date.toDateString()}: ${tx.description}`);
      console.log(`     Account: ${tx.account.name} (${tx.account.type}${tx.account.investment ? ' - INVESTMENT' : ''})`);
      console.log(`     Amount: $${(tx.amount / 100).toLocaleString()}`);

      if (tx.reference) {
        console.log(`     Reference: ${tx.reference}`);

        if (tx.reference.startsWith("investment_valuation_")) {
          valuationAdjustments.push(tx);
          console.log(`     ⚠️  VALUATION ADJUSTMENT`);
        } else if (tx.reference.startsWith("investment_trade_")) {
          investmentTransactions.push(tx);
          console.log(`     💰 INVESTMENT TRADE`);
        }
      }

      if (tx.account.investment) {
        if (!tx.reference || (!tx.reference.startsWith("investment_valuation_") && !tx.reference.startsWith("investment_trade_"))) {
          console.log(`     ⚠️  UNTAGGED INVESTMENT ACCOUNT TRANSACTION`);
        }
      } else {
        regularTransactions.push(tx);
        console.log(`     ✅ REGULAR TRANSACTION`);
      }

      if (tx.splits.length > 0) {
        console.log(`     Categories: ${tx.splits.map(s => `${s.category.name} (${s.category.type}): $${(s.amount / 100).toFixed(2)}`).join(", ")}`);
      } else {
        console.log(`     ❌ UNCATEGORIZED`);
      }
      console.log("");
    }

    // Now test how the dashboard would calculate income/expenses
    console.log("📈 Dashboard Income/Expense Calculation Test:");

    // This mirrors the logic from dashboard/page.tsx
    const monthlySplits = await prisma.transactionSplit.findMany({
      where: {
        userId: user.id,
        transaction: {
          date: {
            gte: monthStart,
            lte: monthEnd,
          },
        },
      },
      include: {
        category: true,
        transaction: {
          select: {
            date: true,
            reference: true,
            account: {
              include: {
                investment: true
              }
            }
          },
        },
      },
    });

    // Filter splits like the dashboard does
    const incomeSplits = monthlySplits.filter(
      (split) =>
        split.category.type === "INCOME" &&
        !(split.transaction.reference && split.transaction.reference.startsWith("transfer_"))
    );

    const expenseSplits = monthlySplits.filter(
      (split) =>
        split.category.type === "EXPENSE" &&
        !(split.transaction.reference && split.transaction.reference.startsWith("transfer_"))
    );

    console.log(`\n💰 Income Splits Found: ${incomeSplits.length}`);
    for (const split of incomeSplits) {
      const isInvestment = split.transaction.account.investment !== null;
      console.log(`   ${split.category.name}: $${(split.amount / 100).toFixed(2)}${isInvestment ? ' (INVESTMENT ACCOUNT)' : ''}`);
      if (split.transaction.reference) {
        console.log(`     Reference: ${split.transaction.reference}`);
      }
    }

    console.log(`\n💸 Expense Splits Found: ${expenseSplits.length}`);
    for (const split of expenseSplits) {
      const isInvestment = split.transaction.account.investment !== null;
      console.log(`   ${split.category.name}: $${(Math.abs(split.amount) / 100).toFixed(2)}${isInvestment ? ' (INVESTMENT ACCOUNT)' : ''}`);
      if (split.transaction.reference) {
        console.log(`     Reference: ${split.transaction.reference}`);
      }
    }

    // Check uncategorized transactions
    const uncategorizedTransactions = await prisma.transaction.findMany({
      where: {
        userId: user.id,
        date: {
          gte: monthStart,
          lte: monthEnd,
        },
        splits: {
          none: {},
        },
      },
      include: {
        account: {
          include: {
            investment: true
          }
        }
      }
    });

    console.log(`\n❓ Uncategorized Transactions: ${uncategorizedTransactions.length}`);
    for (const tx of uncategorizedTransactions) {
      const isInvestment = tx.account.investment !== null;
      const type = tx.amount > 0 ? "INCOME" : "EXPENSE";
      console.log(`   ${tx.description}: $${(Math.abs(tx.amount) / 100).toFixed(2)} (${type})${isInvestment ? ' (INVESTMENT ACCOUNT)' : ''}`);
      if (tx.reference) {
        console.log(`     Reference: ${tx.reference}`);
      }
    }

    // Calculate totals as dashboard would
    const monthlyIncome = incomeSplits.reduce((sum, split) => sum + split.amount, 0);
    const monthlyExpenses = expenseSplits.reduce((sum, split) => sum + Math.abs(split.amount), 0);

    const uncategorizedExpense = uncategorizedTransactions
      .filter((tx) =>
        tx.amount < 0 &&
        !(tx.reference && tx.reference.startsWith("transfer_")) &&
        !(tx.reference && tx.reference.startsWith("investment_"))
      )
      .reduce((sum, tx) => sum + Math.abs(tx.amount), 0);

    const uncategorizedIncome = uncategorizedTransactions
      .filter((tx) =>
        tx.amount > 0 &&
        !(tx.reference && tx.reference.startsWith("transfer_")) &&
        !(tx.reference && tx.reference.startsWith("investment_"))
      )
      .reduce((sum, tx) => sum + tx.amount, 0);

    const totalIncome = monthlyIncome + uncategorizedIncome;
    const totalExpenses = monthlyExpenses + uncategorizedExpense;

    console.log(`\n📊 Final Dashboard Totals:`);
    console.log(`   Total Income: $${(totalIncome / 100).toLocaleString()}`);
    console.log(`   Total Expenses: $${(totalExpenses / 100).toLocaleString()}`);
    console.log(`   Net Cash Flow: $${((totalIncome - totalExpenses) / 100).toLocaleString()}`);

    console.log(`\n🔍 Separation Analysis:`);
    console.log(`   Investment Trades: ${investmentTransactions.length}`);
    console.log(`   Valuation Adjustments: ${valuationAdjustments.length}`);
    console.log(`   Regular Transactions: ${regularTransactions.length}`);

    // Check if any investment-related transactions are being counted in income/expense
    const problematicSplits = monthlySplits.filter(split => {
      const isInvestmentAccount = split.transaction.account.investment !== null;
      const isValuationAdj = split.transaction.reference?.startsWith("investment_valuation_");
      const isInvestmentTrade = split.transaction.reference?.startsWith("investment_trade_");

      return isInvestmentAccount || isValuationAdj || isInvestmentTrade;
    });

    if (problematicSplits.length > 0) {
      console.log(`\n⚠️  POTENTIAL ISSUES FOUND:`);
      console.log(`   ${problematicSplits.length} investment-related splits are being included in income/expense calculations!`);

      for (const split of problematicSplits) {
        console.log(`   - ${split.category.name} (${split.category.type}): $${(split.amount / 100).toFixed(2)}`);
        console.log(`     From: ${split.transaction.reference || 'No reference'}`);
      }
    } else {
      console.log(`\n✅ GOOD: No investment transactions found in income/expense calculations`);
    }

  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    await prisma.$disconnect();
  }
})();