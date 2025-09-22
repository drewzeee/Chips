// Shared investment account calculation functions
import { fetchAllAssetPrices, calculatePositionValue, type AssetPosition } from './asset-prices';

export interface InvestmentAccountBalance {
  totalValue: number;
  cashBalance: number;
  holdingsValue: number;
  holdings: Array<{
    symbol: string;
    assetType: 'CRYPTO' | 'EQUITY';
    quantity: number;
    marketValue: number;
  }>;
}

export async function calculateInvestmentAccountBalance(
  investmentAccountId: string,
  openingBalance: number, // in cents
  trades: Array<{
    type: string;
    assetType: 'CRYPTO' | 'EQUITY' | null;
    symbol: string | null;
    quantity: string | null;
    amount: number; // in cents
    fees: number | null; // in cents
  }>
): Promise<InvestmentAccountBalance> {
  // Calculate holdings from transactions (same logic as ledger)
  const holdingsMap = new Map<string, {
    symbol: string;
    assetType: 'CRYPTO' | 'EQUITY';
    quantity: number;
    totalCost: number; // in cents
  }>();

  let cashBalance = openingBalance; // Start with opening balance in cents

  // Process all transactions
  for (const trade of trades) {
    const amount = trade.amount; // In cents
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
      };

      if (trade.type === 'BUY') {
        existing.quantity += quantity;
        existing.totalCost += amount + fees;
        cashBalance -= (amount + fees);
      } else if (trade.type === 'SELL') {
        const sellValue = amount - fees;
        existing.quantity -= quantity;

        // Calculate cost basis to remove (proportional)
        if (existing.quantity + quantity > 0) {
          const costBasisPerShare = existing.totalCost / (existing.quantity + quantity);
          const costBasisSold = costBasisPerShare * quantity;
          existing.totalCost -= costBasisSold;
        } else {
          existing.totalCost = 0;
        }

        cashBalance += sellValue;
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

  // Calculate market values
  const holdings = activeHoldings.map(holding => {
    const pricedPosition = calculatePositionValue({
      symbol: holding.symbol,
      assetType: holding.assetType,
      quantity: holding.quantity
    }, priceData);

    return {
      symbol: holding.symbol,
      assetType: holding.assetType,
      quantity: holding.quantity,
      marketValue: pricedPosition.totalValue // Already in dollars
    };
  });

  const holdingsValue = holdings.reduce((sum, h) => sum + h.marketValue, 0);
  const cashBalanceInDollars = cashBalance / 100; // Convert cents to dollars
  const totalValue = holdingsValue + cashBalanceInDollars;

  return {
    totalValue,
    cashBalance: cashBalanceInDollars,
    holdingsValue,
    holdings
  };
}