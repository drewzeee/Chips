import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedUser, unauthorizedResponse } from "@/lib/auth-helpers";
import { fetchAllAssetPrices, calculatePositionValue, type AssetPosition } from "@/lib/asset-prices";
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

    // Collect all positions across accounts
    const allPositions: AssetPosition[] = [];
    const accountPositions = new Map<string, {
      account: typeof investmentAccounts[0];
      positions: AssetPosition[];
    }>();

    for (const account of investmentAccounts) {
      const positionMap = new Map<string, { quantity: number; symbol: string; assetType: 'CRYPTO' | 'EQUITY' | null }>();

      // Calculate current positions from trades
      for (const trade of account.trades) {
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

      // Convert to AssetPosition array with non-zero quantities
      const positions: AssetPosition[] = [];
      for (const [, position] of positionMap) {
        if (position.quantity > 0 && position.assetType) {
          const assetPosition: AssetPosition = {
            symbol: position.symbol,
            assetType: position.assetType,
            quantity: position.quantity
          };
          positions.push(assetPosition);
          allPositions.push(assetPosition);
        }
      }

      if (positions.length > 0) {
        accountPositions.set(account.id, { account, positions });
      }
    }

    if (allPositions.length === 0) {
      return NextResponse.json({
        success: true,
        processed: investmentAccounts.length,
        updated: 0,
        results: [],
        errors: ["No active positions found"]
      });
    }

    const cryptoSymbols = allPositions.filter(p => p.assetType === 'CRYPTO').map(p => p.symbol);
    const stockSymbols = allPositions.filter(p => p.assetType === 'EQUITY').map(p => p.symbol);

    console.log(`💰 Fetching prices - Crypto: [${cryptoSymbols.join(", ")}], Stocks: [${stockSymbols.join(", ")}]`);

    // Fetch current prices for all asset types
    const priceData = await fetchAllAssetPrices(allPositions);

    const totalPricesFetched = Object.keys(priceData.cryptoPrices).length + Object.keys(priceData.stockPrices).length;
    if (totalPricesFetched === 0) {
      return NextResponse.json({
        success: false,
        processed: 0,
        updated: 0,
        results: [],
        errors: ["Failed to fetch any asset prices"]
      });
    }

    console.log(`📈 Retrieved prices - Crypto: ${Object.keys(priceData.cryptoPrices).length}, Stocks: ${Object.keys(priceData.stockPrices).length}`);

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
        for (const position of positions) {
          const pricedPosition = calculatePositionValue(position, priceData);

          if (pricedPosition.pricePerUnit === 0) {
            errors.push(`No price found for ${position.symbol} (${position.assetType}) in account ${account.account.name}`);
            continue;
          }

          totalAccountValue += pricedPosition.totalValue;

          // Get previous valuation for comparison
          const previousValue = account.valuations[0]?.value || account.account.openingBalance;
          const change = (pricedPosition.totalValue * 100) - previousValue; // Convert to cents
          const changePercent = previousValue > 0 ? (change / previousValue) * 100 : 0;

          accountResults.push({
            investmentAccountId: accountId,
            accountName: account.account.name,
            assetSymbol: `${position.symbol} (${position.assetType})`,
            quantity: position.quantity,
            oldValue: previousValue / 100,
            newValue: pricedPosition.totalValue,
            change: change / 100,
            changePercent,
            pricePerUnit: pricedPosition.pricePerUnit
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

  } catch {
    return NextResponse.json({ error: "Failed to get valuation status" }, { status: 500 });
  }
}