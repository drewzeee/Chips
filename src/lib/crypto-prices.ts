// CoinGecko API integration for crypto prices
const COINGECKO_API_BASE = "https://api.coingecko.com/api/v3";

// Map common currency symbols to CoinGecko IDs
export const CURRENCY_ID_MAP: Record<string, string> = {
  BTC: "bitcoin",
  ETH: "ethereum",
  USDC: "usd-coin",
  USDT: "tether",
  ADA: "cardano",
  SOL: "solana",
  DOT: "polkadot",
  MATIC: "matic-network",
  AVAX: "avalanche-2",
  LINK: "chainlink",
  UNI: "uniswap",
  AAVE: "aave",
  COMP: "compound-governance-token",
  MKR: "maker",
  SNX: "havven",
  YFI: "yearn-finance",
  SUSHI: "sushi",
  CRV: "curve-dao-token",
  BAL: "balancer",
  SILO: "silo-finance",
  METIS: "metis-token",
  VELO: "velodrome-finance",
  // Add more as needed
};

export interface CryptoPrice {
  id: string;
  symbol: string;
  current_price: number;
  price_change_24h?: number;
  price_change_percentage_24h?: number;
  last_updated: string;
}

export interface PriceMap {
  [symbol: string]: number;
}

export interface PriceChangeMap {
  [symbol: string]: {
    price: number;
    change24h: number;
    changePercent24h: number;
  };
}

// Cache prices for 5 minutes to avoid rate limiting
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
let priceCache: { data: PriceMap; timestamp: number } | null = null;
let priceChangeCache: { data: PriceChangeMap; timestamp: number } | null = null;

export async function fetchCryptoPrices(symbols: string[]): Promise<PriceMap> {
  // Check cache first
  if (priceCache && Date.now() - priceCache.timestamp < CACHE_DURATION) {
    const cachedPrices: PriceMap = {};
    for (const symbol of symbols) {
      if (priceCache.data[symbol] !== undefined) {
        cachedPrices[symbol] = priceCache.data[symbol];
      }
    }
    if (Object.keys(cachedPrices).length === symbols.length) {
      return cachedPrices;
    }
  }

  // Get CoinGecko IDs for the symbols
  const ids = symbols
    .map(symbol => CURRENCY_ID_MAP[symbol.toUpperCase()])
    .filter(Boolean);

  if (ids.length === 0) {
    console.warn("No valid cryptocurrency IDs found for symbols:", symbols);
    return {};
  }

  try {
    const response = await fetch(
      `${COINGECKO_API_BASE}/simple/price?ids=${ids.join(",")}&vs_currencies=usd&include_24hr_change=true&include_last_updated_at=true`,
      {
        headers: {
          "Accept": "application/json",
        },
      }
    );

    if (!response.ok) {
      throw new Error(`CoinGecko API error: ${response.status}`);
    }

    const data = await response.json();

    // Convert from CoinGecko format to symbol-based format
    const priceMap: PriceMap = {};

    for (const symbol of symbols) {
      const id = CURRENCY_ID_MAP[symbol.toUpperCase()];
      if (id && data[id]?.usd) {
        priceMap[symbol.toUpperCase()] = data[id].usd;
      }
    }

    // Update cache
    priceCache = {
      data: { ...priceCache?.data, ...priceMap },
      timestamp: Date.now(),
    };

    return priceMap;
  } catch (error) {
    console.error("Failed to fetch crypto prices:", error);
    return {};
  }
}

export async function fetchCryptoPricesWithChange(symbols: string[]): Promise<PriceChangeMap> {
  // Check cache first
  if (priceChangeCache && Date.now() - priceChangeCache.timestamp < CACHE_DURATION) {
    const cachedPrices: PriceChangeMap = {};
    for (const symbol of symbols) {
      if (priceChangeCache.data[symbol] !== undefined) {
        cachedPrices[symbol] = priceChangeCache.data[symbol];
      }
    }
    if (Object.keys(cachedPrices).length === symbols.length) {
      return cachedPrices;
    }
  }

  // Get CoinGecko IDs for the symbols
  const ids = symbols
    .map(symbol => CURRENCY_ID_MAP[symbol.toUpperCase()])
    .filter(Boolean);

  if (ids.length === 0) {
    console.warn("No valid cryptocurrency IDs found for symbols:", symbols);
    return {};
  }

  try {
    const response = await fetch(
      `${COINGECKO_API_BASE}/simple/price?ids=${ids.join(",")}&vs_currencies=usd&include_24hr_change=true&include_last_updated_at=true`,
      {
        headers: {
          "Accept": "application/json",
        },
      }
    );

    if (!response.ok) {
      throw new Error(`CoinGecko API error: ${response.status}`);
    }

    const data = await response.json();

    // Convert from CoinGecko format to symbol-based format with 24h change
    const priceChangeMap: PriceChangeMap = {};

    for (const symbol of symbols) {
      const id = CURRENCY_ID_MAP[symbol.toUpperCase()];
      if (id && data[id]?.usd) {
        priceChangeMap[symbol.toUpperCase()] = {
          price: data[id].usd,
          change24h: data[id].usd_24h_change || 0,
          changePercent24h: data[id].usd_24h_change ?
            (data[id].usd_24h_change / (data[id].usd - data[id].usd_24h_change)) * 100 : 0
        };
      }
    }

    // Update cache
    priceChangeCache = {
      data: { ...priceChangeCache?.data, ...priceChangeMap },
      timestamp: Date.now(),
    };

    return priceChangeMap;
  } catch (error) {
    console.error("Failed to fetch crypto prices with change:", error);
    return {};
  }
}

export function getUSDValue(amount: number, symbol: string, prices: PriceMap): number {
  const upperSymbol = symbol.toUpperCase();

  // USD and USD-pegged stablecoins
  if (upperSymbol === "USD" || upperSymbol === "USDC" || upperSymbol === "USDT") {
    return amount;
  }

  const price = prices[upperSymbol];
  if (price === undefined) {
    console.warn(`No price found for ${upperSymbol}`);
    return 0;
  }

  return amount * price;
}

export async function convertBalancesToUSD(
  balances: Array<{ amount: number; currency: string }>
): Promise<Array<{ amount: number; currency: string; usdValue: number }>> {
  const symbols = [...new Set(balances.map(b => b.currency))];
  const prices = await fetchCryptoPrices(symbols);

  return balances.map(balance => ({
    ...balance,
    usdValue: getUSDValue(balance.amount, balance.currency, prices),
  }));
}