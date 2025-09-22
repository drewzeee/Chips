import "dotenv/config";
import { fetchGeminiBalances, fetchGeminiSymbols } from "@/lib/integrations/gemini";

(async () => {
  console.log("Testing Gemini API...\n");

  try {
    // Test public endpoint first (no auth required)
    console.log("Fetching available symbols...");
    const symbols = await fetchGeminiSymbols();
    console.log(`Found ${symbols.length} symbols:`, symbols.slice(0, 10), "...\n");

    // Test authenticated endpoint
    console.log("Fetching account balances...");
    const balances = await fetchGeminiBalances();

    if (balances.length === 0) {
      console.log("No balances found (account might be empty)");
    } else {
      console.table(
        balances
          .filter(balance => parseFloat(balance.amount) > 0)
          .map((balance) => ({
            currency: balance.currency,
            amount: balance.amount,
            available: balance.available,
            type: balance.type,
          }))
      );
    }
  } catch (error) {
    console.error("Error:", error);
  }
})();