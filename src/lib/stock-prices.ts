// Yahoo Finance API integration for stock prices
const YAHOO_FINANCE_API_BASE = "https://query1.finance.yahoo.com/v8/finance/chart";

export interface StockPrice {
  symbol: string;
  current_price: number;
  last_updated: string;
  currency?: string;
}

export interface StockPriceMap {
  [symbol: string]: number;
}

export interface StockPriceChangeMap {
  [symbol: string]: {
    price: number;
    change24h: number;
    changePercent24h: number;
  };
}

// Cache prices for 5 minutes to avoid rate limiting
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
let stockPriceCache: { data: StockPriceMap; timestamp: number } | null = null;
let stockPriceChangeCache: { data: StockPriceChangeMap; timestamp: number } | null = null;

// Common stock symbol transformations
function normalizeStockSymbol(symbol: string): string {
  const upper = symbol.toUpperCase();

  // Add common suffix transformations if needed
  // For example, some symbols might need .TO for Toronto, .L for London, etc.
  return upper;
}

export async function fetchStockPrices(symbols: string[]): Promise<StockPriceMap> {
  // Check cache first
  if (stockPriceCache && Date.now() - stockPriceCache.timestamp < CACHE_DURATION) {
    const cachedPrices: StockPriceMap = {};
    for (const symbol of symbols) {
      const normalizedSymbol = normalizeStockSymbol(symbol);
      if (stockPriceCache.data[normalizedSymbol] !== undefined) {
        cachedPrices[normalizedSymbol] = stockPriceCache.data[normalizedSymbol];
      }
    }
    if (Object.keys(cachedPrices).length === symbols.length) {
      return cachedPrices;
    }
  }

  if (symbols.length === 0) {
    return {};
  }

  const priceMap: StockPriceMap = {};
  const errors: string[] = [];

  // Yahoo Finance allows batch requests, but we'll do individual requests for better error handling
  for (const symbol of symbols) {
    try {
      const normalizedSymbol = normalizeStockSymbol(symbol);
      const response = await fetch(
        `${YAHOO_FINANCE_API_BASE}/${normalizedSymbol}?interval=1d&range=1d&includePrePost=true`,
        {
          headers: {
            "Accept": "application/json",
            "User-Agent": "Mozilla/5.0 (compatible; Investment-Tracker/1.0)",
          },
        }
      );

      if (!response.ok) {
        errors.push(`Yahoo Finance API error for ${symbol}: ${response.status}`);
        continue;
      }

      const data = await response.json();

      // Extract current price from Yahoo Finance response
      const chart = data?.chart?.result?.[0];
      if (!chart) {
        errors.push(`No chart data found for ${symbol}`);
        continue;
      }

      const meta = chart.meta;
      if (!meta) {
        errors.push(`No metadata found for ${symbol}`);
        continue;
      }

      // Get the current price - Yahoo provides regularMarketPrice or previousClose
      const currentPrice = meta.regularMarketPrice || meta.previousClose;
      if (typeof currentPrice === 'number' && currentPrice > 0) {
        priceMap[normalizedSymbol] = currentPrice;
      } else {
        errors.push(`Invalid price data for ${symbol}: ${currentPrice}`);
      }
    } catch (error) {
      errors.push(`Failed to fetch price for ${symbol}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  if (errors.length > 0) {
    console.warn("Stock price fetch errors:", errors);
  }

  // Update cache
  stockPriceCache = {
    data: { ...stockPriceCache?.data, ...priceMap },
    timestamp: Date.now(),
  };

  return priceMap;
}

export async function fetchStockPricesWithChange(symbols: string[]): Promise<StockPriceChangeMap> {
  // Check cache first
  if (stockPriceChangeCache && Date.now() - stockPriceChangeCache.timestamp < CACHE_DURATION) {
    const cachedPrices: StockPriceChangeMap = {};
    for (const symbol of symbols) {
      const normalizedSymbol = normalizeStockSymbol(symbol);
      if (stockPriceChangeCache.data[normalizedSymbol] !== undefined) {
        cachedPrices[normalizedSymbol] = stockPriceChangeCache.data[normalizedSymbol];
      }
    }
    if (Object.keys(cachedPrices).length === symbols.length) {
      return cachedPrices;
    }
  }

  if (symbols.length === 0) {
    return {};
  }

  const priceChangeMap: StockPriceChangeMap = {};
  const errors: string[] = [];

  // Fetch individual stock data with price change information
  for (const symbol of symbols) {
    try {
      const normalizedSymbol = normalizeStockSymbol(symbol);
      const response = await fetch(
        `${YAHOO_FINANCE_API_BASE}/${normalizedSymbol}?interval=1d&range=2d&includePrePost=true`,
        {
          headers: {
            "Accept": "application/json",
            "User-Agent": "Mozilla/5.0 (compatible; Investment-Tracker/1.0)",
          },
        }
      );

      if (!response.ok) {
        errors.push(`Yahoo Finance API error for ${symbol}: ${response.status}`);
        continue;
      }

      const data = await response.json();

      // Extract current price and previous close from Yahoo Finance response
      const chart = data?.chart?.result?.[0];
      if (!chart) {
        errors.push(`No chart data found for ${symbol}`);
        continue;
      }

      const meta = chart.meta;
      if (!meta) {
        errors.push(`No metadata found for ${symbol}`);
        continue;
      }

      // Get the current price and previous close
      const currentPrice = meta.regularMarketPrice || meta.previousClose;
      const previousClose = meta.chartPreviousClose || meta.previousClose;

      if (typeof currentPrice === 'number' && currentPrice > 0) {
        const change24h = currentPrice - (previousClose || currentPrice);
        const changePercent24h = previousClose && previousClose > 0 ?
          ((currentPrice - previousClose) / previousClose) * 100 : 0;

        priceChangeMap[normalizedSymbol] = {
          price: currentPrice,
          change24h,
          changePercent24h
        };
      } else {
        errors.push(`Invalid price data for ${symbol}: ${currentPrice}`);
      }
    } catch (error) {
      errors.push(`Failed to fetch price for ${symbol}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  if (errors.length > 0) {
    console.warn("Stock price fetch errors:", errors);
  }

  // Update cache
  stockPriceChangeCache = {
    data: { ...stockPriceChangeCache?.data, ...priceChangeMap },
    timestamp: Date.now(),
  };

  return priceChangeMap;
}

export function getUSDValueFromStock(amount: number, symbol: string, prices: StockPriceMap): number {
  const normalizedSymbol = normalizeStockSymbol(symbol);

  const price = prices[normalizedSymbol];
  if (price === undefined) {
    console.warn(`No stock price found for ${normalizedSymbol}`);
    return 0;
  }

  return amount * price;
}

export async function convertStockBalancesToUSD(
  balances: Array<{ amount: number; symbol: string }>
): Promise<Array<{ amount: number; symbol: string; usdValue: number }>> {
  const symbols = [...new Set(balances.map(b => b.symbol))];
  const prices = await fetchStockPrices(symbols);

  return balances.map(balance => ({
    ...balance,
    usdValue: getUSDValueFromStock(balance.amount, balance.symbol, prices),
  }));
}

// Validate if a symbol looks like a stock ticker
export function isValidStockSymbol(symbol: string): boolean {
  if (!symbol || typeof symbol !== 'string') return false;

  const normalized = symbol.trim().toUpperCase();

  // Basic validation: 1-5 characters, letters only (with optional dot for exchanges)
  return /^[A-Z]{1,5}(\.[A-Z]{1,3})?$/.test(normalized);
}

// Get market status for a symbol (simplified)
export async function getMarketStatus(symbol: string): Promise<'OPEN' | 'CLOSED' | 'UNKNOWN'> {
  try {
    const normalizedSymbol = normalizeStockSymbol(symbol);
    const response = await fetch(
      `${YAHOO_FINANCE_API_BASE}/${normalizedSymbol}?interval=1d&range=1d`,
      {
        headers: {
          "Accept": "application/json",
          "User-Agent": "Mozilla/5.0 (compatible; Investment-Tracker/1.0)",
        },
      }
    );

    if (!response.ok) return 'UNKNOWN';

    const data = await response.json();
    const meta = data?.chart?.result?.[0]?.meta;

    if (meta?.marketState) {
      return meta.marketState === 'REGULAR' ? 'OPEN' : 'CLOSED';
    }

    return 'UNKNOWN';
  } catch {
    return 'UNKNOWN';
  }
}