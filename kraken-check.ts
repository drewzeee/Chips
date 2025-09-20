import "dotenv/config";
import { fetchKrakenBalances } from "@/lib/integrations/kraken";
import { convertBalancesToUSD } from "@/lib/crypto-prices";

(async () => {
  console.log("Testing Kraken API...\n");

  try {
    console.log("Fetching Kraken balances...");
    const balances = await fetchKrakenBalances();

    if (balances.length === 0) {
      console.log("No balances found (account might be empty)");
    } else {
      console.log("Raw balances:", balances);

      // Convert to USD values
      console.log("\nConverting to USD...");
      const balancesWithUSD = await convertBalancesToUSD(
        balances.map(b => ({ amount: b.amount, currency: b.currency }))
      );

      const enrichedBalances = balances.map((balance, index) => ({
        ...balance,
        usdValue: balancesWithUSD[index]?.usdValue || 0,
      }));

      console.table(enrichedBalances.map(b => ({
        currency: b.currency,
        amount: b.amount.toFixed(8),
        usdValue: `$${b.usdValue.toFixed(2)}`,
        source: b.source,
      })));

      const totalUSD = enrichedBalances.reduce((sum, b) => sum + b.usdValue, 0);
      console.log(`\nTotal Kraken value: $${totalUSD.toFixed(2)}`);
    }
  } catch (error) {
    console.error("Error:", error);
  }
})();