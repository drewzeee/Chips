// Unified asset price fetching for both crypto and stocks
import { fetchCryptoPrices, fetchCryptoPricesWithChange, getUSDValue as getCryptoUSDValue, type PriceMap as CryptoPriceMap, type PriceChangeMap as CryptoPriceChangeMap } from './crypto-prices';
import { fetchStockPrices, fetchStockPricesWithChange, getUSDValueFromStock, type StockPriceMap, type StockPriceChangeMap } from './stock-prices';

export interface AssetPosition {
  symbol: string;
  assetType: 'CRYPTO' | 'EQUITY';
  quantity: number;
}

export interface PricedPosition extends AssetPosition {
  pricePerUnit: number;
  totalValue: number;
}

export interface PricedPositionWithChange extends PricedPosition {
  change24h: number;
  changePercent24h: number;
}

export interface PriceData {
  cryptoPrices: CryptoPriceMap;
  stockPrices: StockPriceMap;
}

export interface PriceDataWithChange {
  cryptoPrices: CryptoPriceChangeMap;
  stockPrices: StockPriceChangeMap;
}

export async function fetchAllAssetPrices(positions: AssetPosition[]): Promise<PriceData> {
  // Separate crypto and stock symbols
  const cryptoSymbols = positions
    .filter(p => p.assetType === 'CRYPTO')
    .map(p => p.symbol);

  const stockSymbols = positions
    .filter(p => p.assetType === 'EQUITY')
    .map(p => p.symbol);

  // Fetch prices in parallel
  const [cryptoPrices, stockPrices] = await Promise.all([
    cryptoSymbols.length > 0 ? fetchCryptoPrices(cryptoSymbols) : Promise.resolve({}),
    stockSymbols.length > 0 ? fetchStockPrices(stockSymbols) : Promise.resolve({})
  ]);

  return { cryptoPrices, stockPrices };
}

export async function fetchAllAssetPricesWithChange(positions: AssetPosition[]): Promise<PriceDataWithChange> {
  // Separate crypto and stock symbols
  const cryptoSymbols = positions
    .filter(p => p.assetType === 'CRYPTO')
    .map(p => p.symbol);

  const stockSymbols = positions
    .filter(p => p.assetType === 'EQUITY')
    .map(p => p.symbol);

  // Fetch prices with change data in parallel
  const [cryptoPrices, stockPrices] = await Promise.all([
    cryptoSymbols.length > 0 ? fetchCryptoPricesWithChange(cryptoSymbols) : Promise.resolve({}),
    stockSymbols.length > 0 ? fetchStockPricesWithChange(stockSymbols) : Promise.resolve({})
  ]);

  return { cryptoPrices, stockPrices };
}

export function calculatePositionValue(
  position: AssetPosition,
  priceData: PriceData
): PricedPosition {
  let pricePerUnit = 0;
  let totalValue = 0;

  if (position.assetType === 'CRYPTO') {
    pricePerUnit = priceData.cryptoPrices[position.symbol.toUpperCase()] || 0;
    totalValue = getCryptoUSDValue(position.quantity, position.symbol, priceData.cryptoPrices);
  } else if (position.assetType === 'EQUITY') {
    pricePerUnit = priceData.stockPrices[position.symbol.toUpperCase()] || 0;
    totalValue = getUSDValueFromStock(position.quantity, position.symbol, priceData.stockPrices);
  }

  return {
    ...position,
    pricePerUnit,
    totalValue
  };
}

export function calculatePositionValueWithChange(
  position: AssetPosition,
  priceData: PriceDataWithChange
): PricedPositionWithChange {
  let pricePerUnit = 0;
  let totalValue = 0;
  let change24h = 0;
  let changePercent24h = 0;

  if (position.assetType === 'CRYPTO') {
    const cryptoData = priceData.cryptoPrices[position.symbol.toUpperCase()];
    if (cryptoData) {
      pricePerUnit = cryptoData.price;
      totalValue = position.quantity * cryptoData.price;
      change24h = cryptoData.change24h;
      changePercent24h = cryptoData.changePercent24h;
    }
  } else if (position.assetType === 'EQUITY') {
    const stockData = priceData.stockPrices[position.symbol.toUpperCase()];
    if (stockData) {
      pricePerUnit = stockData.price;
      totalValue = position.quantity * stockData.price;
      change24h = stockData.change24h;
      changePercent24h = stockData.changePercent24h;
    }
  }

  return {
    ...position,
    pricePerUnit,
    totalValue,
    change24h,
    changePercent24h
  };
}

export function calculatePortfolioValue(positions: AssetPosition[], priceData: PriceData): {
  positions: PricedPosition[];
  totalValue: number;
  cryptoValue: number;
  stockValue: number;
} {
  const pricedPositions = positions.map(position => calculatePositionValue(position, priceData));

  const totalValue = pricedPositions.reduce((sum, pos) => sum + pos.totalValue, 0);
  const cryptoValue = pricedPositions
    .filter(pos => pos.assetType === 'CRYPTO')
    .reduce((sum, pos) => sum + pos.totalValue, 0);
  const stockValue = pricedPositions
    .filter(pos => pos.assetType === 'EQUITY')
    .reduce((sum, pos) => sum + pos.totalValue, 0);

  return {
    positions: pricedPositions,
    totalValue,
    cryptoValue,
    stockValue
  };
}

export function formatAssetPrice(price: number, assetType: 'CRYPTO' | 'EQUITY'): string {
  if (assetType === 'CRYPTO') {
    // Crypto prices can vary widely, so use more flexible formatting
    if (price < 0.01) {
      return price.toFixed(6);
    } else if (price < 1) {
      return price.toFixed(4);
    } else if (price < 1000) {
      return price.toFixed(2);
    } else {
      return price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
  } else {
    // Stock prices typically use 2 decimal places
    return price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
}

export function getAssetDisplayName(symbol: string, assetType: 'CRYPTO' | 'EQUITY'): string {
  const upperSymbol = symbol.toUpperCase();

  if (assetType === 'CRYPTO') {
    // Common crypto display names
    const cryptoNames: Record<string, string> = {
      BTC: 'Bitcoin',
      ETH: 'Ethereum',
      USDC: 'USD Coin',
      USDT: 'Tether',
      ADA: 'Cardano',
      SOL: 'Solana',
      DOT: 'Polkadot',
      MATIC: 'Polygon',
      AVAX: 'Avalanche',
      LINK: 'Chainlink'
    };
    return cryptoNames[upperSymbol] || upperSymbol;
  } else {
    // For stocks, just return the symbol as companies vary too much
    return upperSymbol;
  }
}