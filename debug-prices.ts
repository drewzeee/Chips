import "dotenv/config";
import { fetchCryptoPrices, getUSDValue } from "@/lib/crypto-prices";

(async () => {
  console.log("🔍 Debugging price discovery...\n");

  try {
    // Test 1: Direct price fetch
    console.log("1. Testing direct price fetch:");
    const prices = await fetchCryptoPrices(["ETH", "BTC", "USDC"]);
    console.log("Prices returned:", prices);

    // Test 2: USD conversion with different amounts
    console.log("\n2. Testing USD conversion:");

    const testCases = [
      { amount: 1, currency: "ETH" },
      { amount: 3, currency: "ETH" },
      { amount: 0.1, currency: "ETH" },
      { amount: 1, currency: "BTC" },
      { amount: 49.82, currency: "USDC" },
    ];

    for (const test of testCases) {
      const usdValue = getUSDValue(test.amount, test.currency, prices);
      console.log(`${test.amount} ${test.currency} = $${usdValue.toFixed(2)}`);
    }

    // Test 3: Check what the dashboard API would return
    console.log("\n3. Testing dashboard API simulation:");

    const geminiBalance = { amount: 3, currency: "ETH" };
    const convertedUSD = getUSDValue(geminiBalance.amount, geminiBalance.currency, prices);

    console.log(`Dashboard would show: ${geminiBalance.amount} ETH = $${convertedUSD.toFixed(2)}`);
    console.log(`Expected: 3 ETH ≈ $${(3 * 4465).toFixed(2)}`);

    // Test 4: Check currency case sensitivity
    console.log("\n4. Testing case sensitivity:");
    console.log("ETH price:", getUSDValue(1, "ETH", prices));
    console.log("eth price:", getUSDValue(1, "eth", prices));
    console.log("Eth price:", getUSDValue(1, "Eth", prices));

  } catch (error) {
    console.error("❌ Error:", error);
  }
})();