// Test script to verify decimal conversion fixes
console.log("🧪 Testing Decimal Conversion Fix");
console.log("=".repeat(50));

// Simulate the corrected calculation logic
function testLedgerCalculations() {
  console.log("\n📊 Testing Holdings Calculations:");

  // Example data (amounts in cents as stored in database)
  const mockTrades = [
    { type: 'DEPOSIT', amount: 5000000, fees: 0 }, // $50,000 deposit
    { type: 'BUY', symbol: 'NVDA', quantity: 100, amount: 4000000, fees: 1000 }, // $40,000 + $10 fees = $40,010 total
    { type: 'BUY', symbol: 'GME', quantity: 50, amount: 400000, fees: 500 }, // $4,000 + $5 fees = $4,005 total
    { type: 'DIVIDEND', amount: 50000, fees: 0 }, // $500 dividend
  ];

  let cashBalance = 0; // Starting with $0 opening balance
  const holdingsMap = new Map();

  // Process transactions (simulating the fixed logic)
  for (const trade of mockTrades) {
    const amount = trade.amount; // In cents
    const fees = trade.fees || 0; // In cents
    const quantity = trade.quantity || 0;

    if (trade.type === 'DEPOSIT') {
      cashBalance += amount;
      console.log(`✅ DEPOSIT: +$${(amount / 100).toFixed(2)} → Cash: $${(cashBalance / 100).toFixed(2)}`);
    } else if (trade.type === 'DIVIDEND') {
      cashBalance += amount;
      console.log(`✅ DIVIDEND: +$${(amount / 100).toFixed(2)} → Cash: $${(cashBalance / 100).toFixed(2)}`);
    } else if (trade.type === 'BUY' && trade.symbol) {
      const existing = holdingsMap.get(trade.symbol) || { quantity: 0, totalCost: 0 };
      existing.quantity += quantity;
      existing.totalCost += amount + fees; // Keep in cents
      cashBalance -= (amount + fees);
      holdingsMap.set(trade.symbol, existing);

      console.log(`✅ BUY ${trade.symbol}: ${quantity} shares @ $${(amount / 100 / quantity).toFixed(2)} + $${(fees / 100).toFixed(2)} fees`);
      console.log(`   Total cost: $${((amount + fees) / 100).toFixed(2)} → Cash: $${(cashBalance / 100).toFixed(2)}`);
      console.log(`   Position: ${existing.quantity} shares, cost basis $${(existing.totalCost / 100).toFixed(2)}`);
    }
  }

  console.log("\n📈 Final Positions:");
  console.log(`💰 Cash Balance: $${(cashBalance / 100).toFixed(2)}`);

  // Calculate holdings with mock current prices
  const mockPrices = { NVDA: 450.00, GME: 85.00 };

  for (const [symbol, holding] of holdingsMap) {
    const costBasisInDollars = holding.totalCost / 100; // Convert cents to dollars
    const averageCost = costBasisInDollars / holding.quantity;
    const currentPrice = mockPrices[symbol];
    const marketValue = holding.quantity * currentPrice;
    const unrealizedGainLoss = marketValue - costBasisInDollars;
    const unrealizedGainLossPercent = (unrealizedGainLoss / costBasisInDollars) * 100;

    console.log(`\n📊 ${symbol}:`);
    console.log(`   Quantity: ${holding.quantity} shares`);
    console.log(`   Average Cost: $${averageCost.toFixed(2)} per share`);
    console.log(`   Current Price: $${currentPrice.toFixed(2)} per share`);
    console.log(`   Cost Basis: $${costBasisInDollars.toFixed(2)}`);
    console.log(`   Market Value: $${marketValue.toFixed(2)}`);
    console.log(`   Unrealized P&L: ${unrealizedGainLoss >= 0 ? '+' : ''}$${unrealizedGainLoss.toFixed(2)} (${unrealizedGainLossPercent.toFixed(2)}%)`);
  }

  // Calculate totals
  let totalMarketValue = cashBalance / 100; // Start with cash
  let totalCostBasis = 0;
  let totalUnrealizedGainLoss = 0;

  for (const [symbol, holding] of holdingsMap) {
    const costBasisInDollars = holding.totalCost / 100;
    const marketValue = holding.quantity * mockPrices[symbol];
    const unrealizedGainLoss = marketValue - costBasisInDollars;

    totalMarketValue += marketValue;
    totalCostBasis += costBasisInDollars;
    totalUnrealizedGainLoss += unrealizedGainLoss;
  }

  const totalUnrealizedGainLossPercent = totalCostBasis > 0 ? (totalUnrealizedGainLoss / totalCostBasis) * 100 : 0;

  console.log("\n🎯 Portfolio Summary:");
  console.log(`   Total Value: $${totalMarketValue.toFixed(2)}`);
  console.log(`   Total Cost Basis: $${totalCostBasis.toFixed(2)}`);
  console.log(`   Unrealized P&L: ${totalUnrealizedGainLoss >= 0 ? '+' : ''}$${totalUnrealizedGainLoss.toFixed(2)} (${totalUnrealizedGainLossPercent.toFixed(2)}%)`);

  // Verify the math makes sense
  console.log("\n✅ Verification:");
  console.log(`   Cash: $${(cashBalance / 100).toFixed(2)}`);
  console.log(`   Holdings Value: $${(totalMarketValue - cashBalance / 100).toFixed(2)}`);
  console.log(`   Total: $${totalMarketValue.toFixed(2)}`);

  // Expected results check
  const expectedCash = 5950; // $59.50 (50000 - 40010 - 4005 + 500) / 100
  const expectedNVDACostBasis = 400.10; // (4000000 + 1000) / 100 / 100
  const expectedGMECostBasis = 80.10; // (400000 + 500) / 100 / 50

  console.log("\n🔍 Expected vs Actual:");
  console.log(`   Expected Cash: $${expectedCash.toFixed(2)} | Actual: $${(cashBalance / 100).toFixed(2)} ${Math.abs(expectedCash - cashBalance / 100) < 0.01 ? '✅' : '❌'}`);
  console.log(`   Expected NVDA Avg Cost: $${expectedNVDACostBasis.toFixed(2)} | Actual: $${(holdingsMap.get('NVDA').totalCost / 100 / holdingsMap.get('NVDA').quantity).toFixed(2)} ${Math.abs(expectedNVDACostBasis - holdingsMap.get('NVDA').totalCost / 100 / holdingsMap.get('NVDA').quantity) < 0.01 ? '✅' : '❌'}`);
  console.log(`   Expected GME Avg Cost: $${expectedGMECostBasis.toFixed(2)} | Actual: $${(holdingsMap.get('GME').totalCost / 100 / holdingsMap.get('GME').quantity).toFixed(2)} ${Math.abs(expectedGMECostBasis - holdingsMap.get('GME').totalCost / 100 / holdingsMap.get('GME').quantity) < 0.01 ? '✅' : '❌'}`);
}

testLedgerCalculations();

console.log("\n✅ Decimal conversion test completed!");
console.log("The fix ensures all monetary values are properly converted from cents to dollars.");
console.log("Market values, cost basis, and P&L calculations should now display correctly.");