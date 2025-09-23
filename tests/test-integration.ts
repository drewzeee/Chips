import "dotenv/config";
import { fetchGeminiBalances } from "@/lib/integrations/gemini";
import { convertBalancesToUSD } from "@/lib/crypto-prices";

(async () => {
  console.log("🧪 Testing complete integration...\n");

  try {
    console.log("📊 1. Fetching Gemini balances...");
    const balances = await fetchGeminiBalances();

    const nonZeroBalances = balances
      .filter(balance => parseFloat(balance.amount) > 0)
      .map(balance => ({
        currency: balance.currency,
        amount: parseFloat(balance.amount),
        available: parseFloat(balance.available),
        type: balance.type,
        source: 'gemini'
      }));

    console.log("Raw balances:", nonZeroBalances);

    console.log("\n💰 2. Converting to USD...");
    const balancesWithUSD = await convertBalancesToUSD(
      nonZeroBalances.map(b => ({ amount: b.amount, currency: b.currency }))
    );

    const enrichedBalances = nonZeroBalances.map((balance, index) => ({
      ...balance,
      usdValue: balancesWithUSD[index]?.usdValue || 0,
    }));

    console.table(enrichedBalances.map(b => ({
      currency: b.currency,
      amount: b.amount.toFixed(8),
      usdValue: `$${b.usdValue.toFixed(2)}`,
    })));

    const totalUSD = enrichedBalances.reduce((sum, b) => sum + b.usdValue, 0);
    console.log(`\n💎 Total crypto value: $${totalUSD.toFixed(2)}`);

    console.log("\n✅ Integration test complete!");
    console.log("\n📌 Next steps:");
    console.log("1. Start your dev server: npm run dev");
    console.log("2. Sign in to your dashboard");
    console.log("3. View the updated net worth with crypto included!");

  } catch (error) {
    console.error("❌ Error:", error);
  }
})();