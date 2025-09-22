// Unified asset price fetching for both crypto and stocks
import { fetchCryptoPrices, getUSDValue as getCryptoUSDValue, type PriceMap as CryptoPriceMap } from './crypto-prices';
import { fetchStockPrices, getUSDValueFromStock, type StockPriceMap } from './stock-prices';

export interface AssetPosition {
  symbol: string;
  assetType: 'CRYPTO' | 'EQUITY';
  quantity: number;
}

export interface PricedPosition extends AssetPosition {
  pricePerUnit: number;
  totalValue: number;
}

export interface PriceData {
  cryptoPrices: CryptoPriceMap;
  stockPrices: StockPriceMap;
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