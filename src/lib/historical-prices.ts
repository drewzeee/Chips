// Historical price fetching for backfilling asset valuations
import { CURRENCY_ID_MAP } from './crypto-prices';

const COINGECKO_API_BASE = "https://api.coingecko.com/api/v3";
const YAHOO_FINANCE_API_BASE = "https://query1.finance.yahoo.com/v8/finance/chart";

export interface HistoricalPriceMap {
  [symbol: string]: number;
}

/**
 * Fetch historical crypto prices from CoinGecko for a specific date (24 hours ago)
 */
export async function fetchHistoricalCryptoPrices(
  symbols: string[],
  daysAgo: number = 1
): Promise<HistoricalPriceMap> {
  const priceMap: HistoricalPriceMap = {};

  for (const symbol of symbols) {
    const id = CURRENCY_ID_MAP[symbol.toUpperCase()];
    if (!id) {
      console.warn(`No CoinGecko ID found for ${symbol}`);
      continue;
    }

    try {
      // Use market_chart endpoint which is more reliable
      // It gives historical price data for a time range
      const to = Math.floor(Date.now() / 1000);
      const from = to - (daysAgo * 24 * 60 * 60);

      const response = await fetch(
        `${COINGECKO_API_BASE}/coins/${id}/market_chart/range?vs_currency=usd&from=${from}&to=${to}`,
        {
          headers: {
            "Accept": "application/json",
          },
        }
      );

      if (!response.ok) {
        console.warn(`CoinGecko API error for ${symbol}: ${response.status}`);
        continue;
      }

      const data = await response.json();

      // Get the price from N days ago (first data point in the range)
      if (data?.prices && data.prices.length > 0) {
        // Find the price closest to N days ago
        // data.prices is an array of [timestamp, price] pairs
        const targetTimestamp = from * 1000; // Convert to milliseconds
        let closestPrice = data.prices[0][1];
        let closestDiff = Math.abs(data.prices[0][0] - targetTimestamp);

        for (const [timestamp, price] of data.prices) {
          const diff = Math.abs(timestamp - targetTimestamp);
          if (diff < closestDiff) {
            closestDiff = diff;
            closestPrice = price;
          }
        }

        priceMap[symbol.toUpperCase()] = closestPrice;
      }

      // Add delay to avoid rate limiting (increased for free tier)
      await new Promise(resolve => setTimeout(resolve, 3000));
    } catch (error) {
      console.error(`Failed to fetch historical crypto price for ${symbol}:`, error);
    }
  }

  return priceMap;
}

/**
 * Fetch historical stock prices from Yahoo Finance for a specific time period
 */
export async function fetchHistoricalStockPrices(
  symbols: string[],
  daysAgo: number = 1
): Promise<HistoricalPriceMap> {
  const priceMap: HistoricalPriceMap = {};

  for (const symbol of symbols) {
    try {
      const normalizedSymbol = symbol.toUpperCase();

      // Calculate timestamps for the period (we want the close price from N days ago)
      const endDate = new Date();
      endDate.setDate(endDate.getDate() - daysAgo);
      endDate.setHours(23, 59, 59, 999);

      const startDate = new Date(endDate);
      startDate.setDate(startDate.getDate() - 1);

      const period1 = Math.floor(startDate.getTime() / 1000);
      const period2 = Math.floor(endDate.getTime() / 1000);

      const response = await fetch(
        `${YAHOO_FINANCE_API_BASE}/${normalizedSymbol}?period1=${period1}&period2=${period2}&interval=1d`,
        {
          headers: {
            "Accept": "application/json",
            "User-Agent": "Mozilla/5.0 (compatible; Investment-Tracker/1.0)",
          },
        }
      );

      if (!response.ok) {
        console.warn(`Yahoo Finance API error for ${symbol}: ${response.status}`);
        continue;
      }

      const data = await response.json();

      const chart = data?.chart?.result?.[0];
      if (!chart) {
        console.warn(`No chart data found for ${symbol}`);
        continue;
      }

      // Get the close price from the historical data
      const closes = chart.indicators?.quote?.[0]?.close;
      if (closes && closes.length > 0) {
        // Get the last close price in the period
        const closePrice = closes[closes.length - 1];
        if (typeof closePrice === 'number' && closePrice > 0) {
          priceMap[normalizedSymbol] = closePrice;
        }
      }

      // Add small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (error) {
      console.error(`Failed to fetch historical stock price for ${symbol}:`, error);
    }
  }

  return priceMap;
}

/**
 * Fetch both crypto and stock historical prices
 */
export async function fetchAllHistoricalPrices(
  assets: Array<{ symbol: string; assetType: 'CRYPTO' | 'EQUITY' }>,
  daysAgo: number = 1
): Promise<HistoricalPriceMap> {
  const cryptoSymbols = assets
    .filter(a => a.assetType === 'CRYPTO')
    .map(a => a.symbol);

  const stockSymbols = assets
    .filter(a => a.assetType === 'EQUITY')
    .map(a => a.symbol);

  const [cryptoPrices, stockPrices] = await Promise.all([
    cryptoSymbols.length > 0 ? fetchHistoricalCryptoPrices(cryptoSymbols, daysAgo) : Promise.resolve({}),
    stockSymbols.length > 0 ? fetchHistoricalStockPrices(stockSymbols, daysAgo) : Promise.resolve({})
  ]);

  return { ...cryptoPrices, ...stockPrices };
}
