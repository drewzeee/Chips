// Test script for stock price fetching
import { fetchStockPrices, isValidStockSymbol, getMarketStatus } from '../src/lib/stock-prices';
import { fetchAllAssetPrices, calculatePortfolioValue, formatAssetPrice, getAssetDisplayName } from '../src/lib/asset-prices';

async function testStockPrices() {
  console.log("🧪 Testing Stock Price Integration");
  console.log("=".repeat(50));

  // Test individual stock price fetching
  console.log("\n📈 Testing Yahoo Finance API:");
  const testSymbols = ['AAPL', 'MSFT', 'GOOGL', 'TSLA', 'NVDA'];

  try {
    const stockPrices = await fetchStockPrices(testSymbols);
    console.log("Stock prices fetched:", stockPrices);

    for (const symbol of testSymbols) {
      const price = stockPrices[symbol];
      if (price) {
        console.log(`✅ ${symbol}: $${formatAssetPrice(price, 'EQUITY')} (${getAssetDisplayName(symbol, 'EQUITY')})`);
      } else {
        console.log(`❌ ${symbol}: No price found`);
      }
    }
  } catch (error) {
    console.error("❌ Stock price fetch failed:", error);
  }

  // Test symbol validation
  console.log("\n🔍 Testing symbol validation:");
  const testValidation = ['AAPL', 'BTC', 'INVALID123', 'A', 'TOOLONG', 'TSM'];
  for (const symbol of testValidation) {
    const isValid = isValidStockSymbol(symbol);
    console.log(`${isValid ? '✅' : '❌'} ${symbol}: ${isValid ? 'Valid' : 'Invalid'} stock symbol`);
  }

  // Test integrated asset price fetching
  console.log("\n💼 Testing integrated portfolio valuation:");
  const testPositions = [
    { symbol: 'AAPL', assetType: 'EQUITY' as const, quantity: 10 },
    { symbol: 'BTC', assetType: 'CRYPTO' as const, quantity: 0.5 },
    { symbol: 'MSFT', assetType: 'EQUITY' as const, quantity: 5 },
    { symbol: 'ETH', assetType: 'CRYPTO' as const, quantity: 2 }
  ];

  try {
    const priceData = await fetchAllAssetPrices(testPositions);
    console.log("\nPrice data retrieved:");
    console.log(`- Crypto prices: ${Object.keys(priceData.cryptoPrices).length} symbols`);
    console.log(`- Stock prices: ${Object.keys(priceData.stockPrices).length} symbols`);

    const portfolio = calculatePortfolioValue(testPositions, priceData);
    console.log("\nPortfolio Summary:");
    console.log(`- Total Value: $${portfolio.totalValue.toFixed(2)}`);
    console.log(`- Crypto Value: $${portfolio.cryptoValue.toFixed(2)}`);
    console.log(`- Stock Value: $${portfolio.stockValue.toFixed(2)}`);

    console.log("\nPosition Details:");
    for (const position of portfolio.positions) {
      const value = position.totalValue;
      const price = formatAssetPrice(position.pricePerUnit, position.assetType);
      console.log(`- ${position.symbol} (${position.assetType}): ${position.quantity} × $${price} = $${value.toFixed(2)}`);
    }
  } catch (error) {
    console.error("❌ Integrated test failed:", error);
  }

  // Test market status
  console.log("\n🕒 Testing market status:");
  try {
    const marketStatus = await getMarketStatus('AAPL');
    console.log(`AAPL market status: ${marketStatus}`);
  } catch (error) {
    console.error("❌ Market status test failed:", error);
  }

  console.log("\n✅ Test completed!");
}

// Run the test
testStockPrices().catch(console.error);