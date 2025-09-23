import "dotenv/config";
import { fetchGeminiBalances } from "@/lib/integrations/gemini";
import { convertBalancesToUSD } from "@/lib/crypto-prices";

(async () => {
  console.log("🧪 Testing API endpoint logic directly...\n");

  try {
    // Simulate the exact same logic as the API endpoint
    const balances = await fetchGeminiBalances();
    console.log("1. Raw Gemini balances:", balances);

    // Filter out zero balances and format for display (like API does)
    const nonZeroBalances = balances
      .filter(balance => parseFloat(balance.amount) > 0)
      .map(balance => ({
        currency: balance.currency,
        amount: parseFloat(balance.amount),
        available: parseFloat(balance.available),
        type: balance.type,
        source: 'gemini'
      }));

    console.log("2. Filtered non-zero balances:", nonZeroBalances);

    // Convert to USD values (like API does)
    const balancesWithUSD = await convertBalancesToUSD(
      nonZeroBalances.map(b => ({ amount: b.amount, currency: b.currency }))
    );

    console.log("3. USD conversion results:", balancesWithUSD);

    // Merge USD values back into the balance objects (like API does)
    const enrichedBalances = nonZeroBalances.map((balance, index) => ({
      ...balance,
      usdValue: balancesWithUSD[index]?.usdValue || 0,
    }));

    console.log("4. Final enriched balances (what API returns):");
    console.table(enrichedBalances);

    // Check ETH specifically
    const ethBalance = enrichedBalances.find(b => b.currency === 'ETH');
    if (ethBalance) {
      console.log(`\n🔍 ETH specifically: ${ethBalance.amount} ETH = $${ethBalance.usdValue.toFixed(2)}`);
      console.log(`Expected: 3 ETH * ~$4470 = ~$13,410`);
    }

  } catch (error) {
    console.error("❌ Error:", error);
  }
})();