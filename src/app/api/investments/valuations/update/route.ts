import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedUser, unauthorizedResponse } from "@/lib/auth-helpers";
import { fetchCryptoPrices } from "@/lib/crypto-prices";
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

    // Get all investment accounts with their latest transactions
    const investmentAccounts = await prisma.investmentAccount.findMany({
      where: { userId: user.id },
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

    // Collect all unique symbols that need pricing
    const symbols = new Set<string>();
    const accountPositions = new Map<string, {
      account: typeof investmentAccounts[0];
      positions: Map<string, { quantity: number; symbol: string }>;
    }>();

    for (const account of investmentAccounts) {
      const positions = new Map<string, { quantity: number; symbol: string }>();

      // Calculate current positions from trades
      for (const trade of account.trades) {
        if (!trade.symbol) continue;

        const symbol = trade.symbol.toUpperCase();
        const quantity = Number(trade.quantity || 0);

        if (trade.type === "BUY") {
          const current = positions.get(symbol) || { quantity: 0, symbol };
          positions.set(symbol, { ...current, quantity: current.quantity + quantity });
        } else if (trade.type === "SELL") {
          const current = positions.get(symbol) || { quantity: 0, symbol };
          positions.set(symbol, { ...current, quantity: current.quantity - quantity });
        }

        symbols.add(symbol);
      }

      // Only keep positions with non-zero quantities
      const nonZeroPositions = new Map();
      for (const [symbol, position] of positions) {
        if (position.quantity > 0) {
          nonZeroPositions.set(symbol, position);
        }
      }

      if (nonZeroPositions.size > 0) {
        accountPositions.set(account.id, { account, positions: nonZeroPositions });
      }
    }

    if (symbols.size === 0) {
      return NextResponse.json({
        success: true,
        processed: investmentAccounts.length,
        updated: 0,
        results: [],
        errors: ["No active positions found"]
      });
    }

    console.log(`💰 Fetching prices for symbols: ${Array.from(symbols).join(", ")}`);

    // Fetch current prices
    const prices = await fetchCryptoPrices(Array.from(symbols));

    if (Object.keys(prices).length === 0) {
      return NextResponse.json({
        success: false,
        processed: 0,
        updated: 0,
        results: [],
        errors: ["Failed to fetch any crypto prices"]
      });
    }

    console.log(`📈 Retrieved prices:`, prices);

    const results: ValuationResult[] = [];
    const errors: string[] = [];
    let updated = 0;

    const asOf = new Date();

    // Process each account
    for (const [accountId, { account, positions }] of accountPositions) {
      try {
        let totalAccountValue = 0;
        const accountResults: ValuationResult[] = [];

        // Calculate total value for this account
        for (const [symbol, position] of positions) {
          const price = prices[symbol];
          if (!price) {
            errors.push(`No price found for ${symbol} in account ${account.account.name}`);
            continue;
          }

          const value = position.quantity * price;
          totalAccountValue += value;

          // Get previous valuation for comparison
          const previousValue = account.valuations[0]?.value || account.account.openingBalance;
          const change = (value * 100) - previousValue; // Convert to cents
          const changePercent = previousValue > 0 ? (change / previousValue) * 100 : 0;

          accountResults.push({
            investmentAccountId: accountId,
            accountName: account.account.name,
            assetSymbol: symbol,
            quantity: position.quantity,
            oldValue: previousValue / 100,
            newValue: value,
            change: change / 100,
            changePercent,
            pricePerUnit: price
          });
        }

        if (totalAccountValue > 0) {
          // Update the investment account valuation
          await prisma.$transaction((tx) =>
            upsertInvestmentAccountValuation({
              tx,
              userId: user.id,
              investmentAccountId: accountId,
              financialAccountId: account.accountId,
              openingBalance: account.account.openingBalance,
              asOf,
              value: Math.round(totalAccountValue * 100) // Convert to cents
            })
          );

          results.push(...accountResults);
          updated++;

          console.log(`✅ Updated ${account.account.name}: $${totalAccountValue.toLocaleString()}`);
        }

      } catch (error) {
        const errorMsg = `Failed to update account ${account.account.name}: ${error instanceof Error ? error.message : 'Unknown error'}`;
        console.error(errorMsg);
        errors.push(errorMsg);
      }
    }

    console.log(`🎉 Valuation automation completed: ${updated} accounts updated`);

    return NextResponse.json({
      success: true,
      processed: accountPositions.size,
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

  } catch (error) {
    return NextResponse.json({ error: "Failed to get valuation status" }, { status: 500 });
  }
}