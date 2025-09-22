import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedUser, unauthorizedResponse } from "@/lib/auth-helpers";
import { fetchAllAssetPrices, calculatePositionValue, type AssetPosition } from "@/lib/asset-prices";

export interface HoldingPosition {
  symbol: string;
  assetType: 'CRYPTO' | 'EQUITY' | 'CASH';
  quantity: number;
  averageCost: number;
  currentPrice: number;
  marketValue: number;
  costBasis: number;
  unrealizedGainLoss: number;
  unrealizedGainLossPercent: number;
}

export interface CashPosition {
  balance: number;
  currency: string;
}

export interface AccountLedger {
  investmentAccountId: string;
  accountName: string;
  accountType: string;
  assetClass: string;
  kind: string;
  currency: string;
  totalValue: number;
  totalCostBasis: number;
  totalUnrealizedGainLoss: number;
  totalUnrealizedGainLossPercent: number;
  cashPosition: CashPosition;
  holdings: HoldingPosition[];
  recentTransactions: Array<{
    id: string;
    type: string;
    assetType: string | null;
    symbol: string | null;
    quantity: string | null;
    pricePerUnit: string | null;
    amount: number;
    fees: number | null;
    occurredAt: string;
    notes: string | null;
  }>;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const user = await getAuthenticatedUser();
  if (!user?.id) {
    return unauthorizedResponse();
  }

  // Get investment account with all related data
  const investmentAccount = await prisma.investmentAccount.findUnique({
    where: { id },
    include: {
      account: true,
      trades: {
        orderBy: { occurredAt: "desc" }
      }
    }
  });

  if (!investmentAccount || investmentAccount.userId !== user.id) {
    return NextResponse.json({ error: "Investment account not found" }, { status: 404 });
  }

  // Calculate holdings from transactions
  const holdingsMap = new Map<string, {
    symbol: string;
    assetType: 'CRYPTO' | 'EQUITY';
    quantity: number;
    totalCost: number;
    transactions: Array<{ type: string; quantity: number; cost: number; date: Date }>;
  }>();

  let cashBalance = investmentAccount.account.openingBalance; // Starting cash in cents

  // Process all transactions to calculate positions and cash
  for (const trade of investmentAccount.trades) {
    const amount = trade.amount; // Always in cents
    const fees = trade.fees || 0; // In cents
    const quantity = Number(trade.quantity || 0);

    if (trade.type === 'DEPOSIT') {
      cashBalance += amount;
    } else if (trade.type === 'WITHDRAW') {
      // Handle both positive and negative withdrawal amounts
      // If amount is negative, it means it was stored as negative, so add it
      // If amount is positive, subtract it as expected
      cashBalance += amount; // This works for both positive and negative stored amounts
    } else if (trade.type === 'DIVIDEND' || trade.type === 'INTEREST') {
      cashBalance += amount;
    } else if (trade.type === 'FEE') {
      cashBalance -= amount;
    } else if (trade.symbol && trade.assetType && (trade.type === 'BUY' || trade.type === 'SELL')) {
      const key = `${trade.symbol}_${trade.assetType}`;
      const existing = holdingsMap.get(key) || {
        symbol: trade.symbol,
        assetType: trade.assetType as 'CRYPTO' | 'EQUITY',
        quantity: 0,
        totalCost: 0,
        transactions: []
      };

      if (trade.type === 'BUY') {
        existing.quantity += quantity;
        existing.totalCost += amount + fees; // Keep in cents for accurate calculation
        cashBalance -= (amount + fees);
        existing.transactions.push({
          type: 'BUY',
          quantity,
          cost: amount + fees,
          date: trade.occurredAt
        });
      } else if (trade.type === 'SELL') {
        const sellValue = amount - fees; // Net proceeds after fees (in cents)
        existing.quantity -= quantity;

        // Calculate cost basis to remove (proportional)
        if (existing.quantity + quantity > 0) {
          const costBasisPerShare = existing.totalCost / (existing.quantity + quantity);
          const costBasisSold = costBasisPerShare * quantity;
          existing.totalCost -= costBasisSold;
        } else {
          existing.totalCost = 0; // Sold everything
        }

        cashBalance += sellValue;
        existing.transactions.push({
          type: 'SELL',
          quantity: -quantity,
          cost: -sellValue,
          date: trade.occurredAt
        });
      }

      holdingsMap.set(key, existing);
    }
  }

  // Filter out zero positions
  const activeHoldings = Array.from(holdingsMap.values()).filter(h => h.quantity > 0);

  // Get current prices for active holdings
  const assetPositions: AssetPosition[] = activeHoldings.map(h => ({
    symbol: h.symbol,
    assetType: h.assetType,
    quantity: h.quantity
  }));

  const priceData = assetPositions.length > 0 ? await fetchAllAssetPrices(assetPositions) : {
    cryptoPrices: {},
    stockPrices: {}
  };

  // Calculate holding positions with current market data
  const holdings: HoldingPosition[] = activeHoldings.map(holding => {
    const pricedPosition = calculatePositionValue({
      symbol: holding.symbol,
      assetType: holding.assetType,
      quantity: holding.quantity
    }, priceData);

    const costBasisInDollars = holding.totalCost / 100; // Convert cents to dollars
    const averageCost = costBasisInDollars / holding.quantity; // Dollars per share
    const marketValue = pricedPosition.totalValue; // Already in dollars from price API
    const unrealizedGainLoss = marketValue - costBasisInDollars;
    const unrealizedGainLossPercent = costBasisInDollars > 0 ? (unrealizedGainLoss / costBasisInDollars) * 100 : 0;

    return {
      symbol: holding.symbol,
      assetType: holding.assetType,
      quantity: holding.quantity,
      averageCost,
      currentPrice: pricedPosition.pricePerUnit,
      marketValue,
      costBasis: costBasisInDollars,
      unrealizedGainLoss,
      unrealizedGainLossPercent
    };
  });

  // Add cash as a position
  const cashPosition: CashPosition = {
    balance: cashBalance / 100, // Convert cents to dollars
    currency: investmentAccount.account.currency
  };

  // Calculate totals (all values now properly in dollars)
  const totalMarketValue = holdings.reduce((sum, h) => sum + h.marketValue, 0) + cashPosition.balance;
  const totalCostBasis = holdings.reduce((sum, h) => sum + h.costBasis, 0);
  const totalUnrealizedGainLoss = holdings.reduce((sum, h) => sum + h.unrealizedGainLoss, 0);
  const totalUnrealizedGainLossPercent = totalCostBasis > 0 ? (totalUnrealizedGainLoss / totalCostBasis) * 100 : 0;

  // Get recent transactions for display
  const recentTransactions = investmentAccount.trades.slice(0, 20).map(trade => ({
    id: trade.id,
    type: trade.type,
    assetType: trade.assetType,
    symbol: trade.symbol,
    quantity: trade.quantity ? trade.quantity.toString() : null,
    pricePerUnit: trade.pricePerUnit ? trade.pricePerUnit.toString() : null,
    amount: trade.amount,
    fees: trade.fees,
    occurredAt: trade.occurredAt.toISOString(),
    notes: trade.notes
  }));

  const ledger: AccountLedger = {
    investmentAccountId: investmentAccount.id,
    accountName: investmentAccount.account.name,
    accountType: investmentAccount.account.type,
    assetClass: investmentAccount.assetClass,
    kind: investmentAccount.kind,
    currency: investmentAccount.account.currency,
    totalValue: totalMarketValue,
    totalCostBasis,
    totalUnrealizedGainLoss,
    totalUnrealizedGainLossPercent,
    cashPosition,
    holdings,
    recentTransactions
  };

  return NextResponse.json(ledger);
}