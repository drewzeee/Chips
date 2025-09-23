import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedUser, unauthorizedResponse } from "@/lib/auth-helpers";
import { startOfMonth, endOfMonth, eachMonthOfInterval, format } from "date-fns";

export async function GET() {
  const user = await getAuthenticatedUser();
  if (!user?.id) {
    return unauthorizedResponse();
  }

  try {
    // Calculate date range - go back far enough to capture historical data
    const endDate = new Date();
    const startDate = new Date();
    startDate.setFullYear(startDate.getFullYear() - 3); // Go back 3 years

    // Get all financial accounts with transaction data
    const [accounts, investmentValuations] = await Promise.all([
      prisma.financialAccount.findMany({
        where: { userId: user.id },
        include: {
          investment: true,
          transactions: {
            where: {
              date: {
                gte: startDate,
                lte: endDate
              }
            },
            orderBy: { date: "asc" }
          }
        }
      }),
      // Get all investment valuations for the user, ordered by date
      prisma.investmentValuation.findMany({
        where: {
          userId: user.id,
          asOf: {
            gte: startDate,
            lte: endDate
          }
        },
        include: {
          account: {
            include: {
              account: true
            }
          }
        },
        orderBy: { asOf: "asc" }
      })
    ]);

    // Generate monthly intervals like the reports API does
    const monthlyIntervals = eachMonthOfInterval({
      start: startOfMonth(startDate),
      end: endOfMonth(endDate)
    });

    const historicalData = monthlyIntervals.map(month => {
      const monthEnd = endOfMonth(month);
      const dateKey = format(monthEnd, "yyyy-MM-dd");

      let totalValue = 0;

      // Calculate traditional account balances as of month end
      for (const account of accounts) {
        if (!account.investment) {
          // Traditional financial account
          const relevantTransactions = account.transactions.filter(
            tx => tx.date <= monthEnd
          );
          const transactionSum = relevantTransactions.reduce(
            (sum, tx) => sum + tx.amount, 0
          );
          const accountBalance = (account.openingBalance + transactionSum) / 100; // Convert to dollars
          totalValue += accountBalance;
        }
      }

      // Add investment account values for this month
      for (const account of accounts) {
        if (account.investment) {
          // Find the most recent valuation up to month end
          const relevantValuations = investmentValuations.filter(
            val => val.account.accountId === account.id && val.asOf <= monthEnd
          );

          if (relevantValuations.length > 0) {
            const latestValuation = relevantValuations[relevantValuations.length - 1];
            const accountValue = latestValuation.value / 100; // Convert to dollars
            totalValue += accountValue;
          }
          // If no valuation data for this investment account in this period, it contributes 0
        }
      }

      return {
        date: dateKey,
        totalValue: Math.round(totalValue * 100) / 100 // Round to 2 decimal places
      };
    });

    // Filter out months with no meaningful data (all accounts at 0)
    const filteredData = historicalData.filter(item =>
      Math.abs(item.totalValue) > 0.01 // Keep if total is not essentially zero
    );

    return NextResponse.json(filteredData);

  } catch (error) {
    console.error("Error fetching historical account values:", error);
    return NextResponse.json(
      { error: "Failed to fetch historical account values" },
      { status: 500 }
    );
  }
}