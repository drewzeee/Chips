import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedUser, unauthorizedResponse } from "@/lib/auth-helpers";
import { calculateInvestmentAccountBalance } from "@/lib/investment-calculations";
import { upsertInvestmentAccountValuation } from "@/app/api/investments/helpers";

interface ValuationResult {
  investmentAccountId: string;
  accountName: string;
  assetSymbol: string;
  quantity: number;
  oldValue: number;
  newValue: number;
  change: number;
  changePercent: number;
  pricePerUnit: number;
}

interface AutoValuationResponse {
  success: boolean;
  processed: number;
  updated: number;
  results: ValuationResult[];
  errors: string[];
}

export async function POST(request: Request) {
  try {
    // Handle internal requests from cron jobs
    const isInternalRequest = request.headers.get("x-internal-request") === "true";
    const userIdFromHeader = request.headers.get("x-user-id");

    let user;
    if (isInternalRequest && userIdFromHeader) {
      // Internal request - get user by ID
      user = await prisma.user.findUnique({
        where: { id: userIdFromHeader },
        select: { id: true, email: true }
      });
      if (!user) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
      }
    } else {
      // Regular request - use authentication
      user = await getAuthenticatedUser();
      if (!user?.id) {
        return unauthorizedResponse();
      }
    }

    console.log(`🔄 Starting automated valuation for user ${user.email}`);

    // Get all investment accounts with trades
    const investmentAccounts = await prisma.investmentAccount.findMany({
      where: { userId: user.id },
      include: {
        account: true,
        trades: true,
        valuations: {
          orderBy: { asOf: "desc" },
          take: 1
        }
      }
    });

    if (investmentAccounts.length === 0) {
      return NextResponse.json({
        success: true,
        processed: 0,
        updated: 0,
        results: [],
        errors: []
      });
    }

    console.log(`📊 Found ${investmentAccounts.length} investment accounts`);

    const results: ValuationResult[] = [];
    const errors: string[] = [];
    let updated = 0;

    const asOf = new Date();

    // Process each account using ledger-style calculation
    for (const account of investmentAccounts) {
      try {
        // Use the same calculation logic as the ledger API
        const balance = await calculateInvestmentAccountBalance(
          account.id,
          account.account.openingBalance,
          account.trades.map(trade => ({
            type: trade.type,
            assetType: trade.assetType,
            symbol: trade.symbol,
            quantity: trade.quantity?.toString() || null,
            amount: trade.amount,
            fees: trade.fees
          }))
        );

        const currentValueInCents = Math.round(balance.totalValue * 100);

        // Get previous valuation for comparison
        const previousValue = account.valuations[0]?.value || account.account.openingBalance;
        const change = currentValueInCents - previousValue;
        const changePercent = previousValue > 0 ? (change / previousValue) * 100 : 0;

        // Create result entry showing cash and holdings breakdown
        results.push({
          investmentAccountId: account.id,
          accountName: account.account.name,
          assetSymbol: `Total (Cash: $${balance.cashBalance.toLocaleString()} + Holdings: $${balance.holdingsValue.toLocaleString()})`,
          quantity: 1,
          oldValue: previousValue / 100,
          newValue: balance.totalValue,
          change: change / 100,
          changePercent,
          pricePerUnit: balance.totalValue
        });

        // Update the investment account valuation using total balance
        await prisma.$transaction((tx) =>
          upsertInvestmentAccountValuation({
            tx,
            userId: user.id,
            investmentAccountId: account.id,
            financialAccountId: account.accountId,
            openingBalance: account.account.openingBalance,
            asOf,
            value: currentValueInCents
          })
        );

        updated++;

        console.log(`✅ Updated ${account.account.name}: $${balance.totalValue.toLocaleString()} (Cash: $${balance.cashBalance.toLocaleString()} + Holdings: $${balance.holdingsValue.toLocaleString()})`);

      } catch (error) {
        const errorMsg = `Failed to update account ${account.account.name}: ${error instanceof Error ? error.message : 'Unknown error'}`;
        console.error(errorMsg);
        errors.push(errorMsg);
      }
    }

    console.log(`🎉 Valuation automation completed: ${updated} accounts updated`);

    return NextResponse.json({
      success: true,
      processed: investmentAccounts.length,
      updated,
      results,
      errors
    } as AutoValuationResponse);

  } catch (error) {
    console.error("❌ Valuation automation failed:", error);

    return NextResponse.json({
      success: false,
      processed: 0,
      updated: 0,
      results: [],
      errors: [error instanceof Error ? error.message : "Unknown error occurred"]
    } as AutoValuationResponse, { status: 500 });
  }
}

// GET endpoint for status/health checks
export async function GET() {
  try {
    const user = await getAuthenticatedUser();
    if (!user?.id) {
      return unauthorizedResponse();
    }

    // Get basic stats about investment accounts
    const stats = await prisma.investmentAccount.findMany({
      where: { userId: user.id },
      include: {
        account: { select: { name: true } },
        valuations: {
          orderBy: { asOf: "desc" },
          take: 1
        },
        _count: {
          select: { trades: true }
        }
      }
    });

    return NextResponse.json({
      accounts: stats.length,
      lastValuation: stats[0]?.valuations[0]?.asOf?.toISOString() || null,
      totalTrades: stats.reduce((sum, acc) => sum + acc._count.trades, 0)
    });

  } catch {
    return NextResponse.json({ error: "Failed to get valuation status" }, { status: 500 });
  }
}