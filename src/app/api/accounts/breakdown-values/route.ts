import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedUser, unauthorizedResponse } from "@/lib/auth-helpers";
import { startOfMonth, endOfMonth, eachMonthOfInterval, format } from "date-fns";

export async function GET(request: Request) {
  const user = await getAuthenticatedUser();
  if (!user?.id) {
    return unauthorizedResponse();
  }

  const { searchParams } = new URL(request.url);
  const months = parseInt(searchParams.get('months') || '12');

  try {
    // Calculate date range
    const endDate = new Date();
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - months);

    // Get all financial accounts
    const accounts = await prisma.financialAccount.findMany({
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
    });

    // Get investment valuations in the date range
    const investmentValuations = await prisma.investmentValuation.findMany({
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
    });

    // Generate monthly intervals
    const monthlyIntervals = eachMonthOfInterval({
      start: startOfMonth(startDate),
      end: endOfMonth(endDate)
    });

    const result = monthlyIntervals.map(month => {
      const monthEnd = endOfMonth(month);
      const monthKey = format(month, "yyyy-MM");
      const displayMonth = format(month, "MMM yyyy");

      const accountValues: Record<string, number> = {};
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

          accountValues[account.name] = Math.round(accountBalance * 100) / 100;
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

            accountValues[account.name] = Math.round(accountValue * 100) / 100;
            totalValue += accountValue;
          } else {
            // No valuation data for this investment account in this period
            accountValues[account.name] = 0;
          }
        }
      }

      return {
        month: monthKey,
        displayMonth,
        totalValue: Math.round(totalValue * 100) / 100,
        accounts: accountValues
      };
    });

    // Filter out months with no data
    const filteredResult = result.filter(item => item.totalValue > 0);

    // Sort accounts by their latest (most recent) value, highest first
    const latestValues = new Map<string, number>();

    if (filteredResult.length > 0) {
      const latestMonth = filteredResult[filteredResult.length - 1];
      for (const [accountName, value] of Object.entries(latestMonth.accounts)) {
        latestValues.set(accountName, value);
      }
    }

    const sortedAccountNames = Array.from(new Set(accounts.map(a => a.name)))
      .sort((a, b) => (latestValues.get(b) || 0) - (latestValues.get(a) || 0));

    return NextResponse.json({
      data: filteredResult,
      accountNames: sortedAccountNames
    });

  } catch (error) {
    console.error("Error fetching account breakdown values:", error);
    return NextResponse.json(
      { error: "Failed to fetch account breakdown values" },
      { status: 500 }
    );
  }
}