import { fetchCryptoPrices, convertBalancesToUSD } from "@/lib/crypto-prices";

(async () => {
  console.log("Testing crypto price API...\n");

  try {
    // Test fetching prices for common cryptocurrencies
    const symbols = ["BTC", "ETH", "USDC"];
    console.log(`Fetching prices for: ${symbols.join(", ")}`);

    const prices = await fetchCryptoPrices(symbols);
    console.log("Prices:", prices);

    // Test conversion with sample balances
    const sampleBalances = [
      { amount: 0.0000000096, currency: "BTC" },
      { amount: 3, currency: "ETH" },
      { amount: 49.82, currency: "USDC" },
      { amount: 0.008478517856225, currency: "USD" },
    ];

    console.log("\nConverting balances to USD:");
    const convertedBalances = await convertBalancesToUSD(sampleBalances);

    console.table(convertedBalances.map(b => ({
      currency: b.currency,
      amount: b.amount,
      usdValue: `$${b.usdValue.toFixed(2)}`,
    })));

    const totalUSD = convertedBalances.reduce((sum, b) => sum + b.usdValue, 0);
    console.log(`\nTotal USD Value: $${totalUSD.toFixed(2)}`);

  } catch (error) {
    console.error("Error:", error);
  }
})();