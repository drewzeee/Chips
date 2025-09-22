import "dotenv/config";
import { fetchGeminiBalances } from "@/lib/integrations/gemini";
import { fetchKrakenBalances } from "@/lib/integrations/kraken";
import { convertBalancesToUSD } from "@/lib/crypto-prices";

(async () => {
  console.log("🧪 Testing all exchange integrations...\n");

  try {
    // Test Gemini
    console.log("📊 Fetching Gemini balances...");
    const geminiBalances = await fetchGeminiBalances();
    const geminiFiltered = geminiBalances
      .filter(balance => parseFloat(balance.amount) > 0)
      .map(balance => ({
        currency: balance.currency,
        amount: parseFloat(balance.amount),
        source: 'gemini'
      }));

    const geminiWithUSD = await convertBalancesToUSD(
      geminiFiltered.map(b => ({ amount: b.amount, currency: b.currency }))
    );

    const geminiEnriched = geminiFiltered.map((balance, index) => ({
      ...balance,
      usdValue: geminiWithUSD[index]?.usdValue || 0,
    }));

    // Test Kraken
    console.log("📊 Fetching Kraken balances...");
    const krakenBalances = await fetchKrakenBalances();
    const krakenWithUSD = await convertBalancesToUSD(
      krakenBalances.map(b => ({ amount: b.amount, currency: b.currency }))
    );

    const krakenEnriched = krakenBalances.map((balance, index) => ({
      ...balance,
      usdValue: krakenWithUSD[index]?.usdValue || 0,
    }));

    // Summary
    console.log("\n💰 Portfolio Summary:");

    const geminiTotal = geminiEnriched.reduce((sum, b) => sum + b.usdValue, 0);
    const krakenTotal = krakenEnriched.reduce((sum, b) => sum + b.usdValue, 0);
    const totalCrypto = geminiTotal + krakenTotal;

    console.log(`Gemini: $${geminiTotal.toFixed(2)}`);
    console.log(`Kraken: $${krakenTotal.toFixed(2)}`);
    console.log(`------------------------`);
    console.log(`Total Crypto: $${totalCrypto.toFixed(2)}`);

    console.log("\n📋 Detailed Balances:");
    console.log("\nGemini:");
    console.table(geminiEnriched.map(b => ({
      currency: b.currency,
      amount: b.amount.toFixed(8),
      usdValue: `$${b.usdValue.toFixed(2)}`,
    })));

    console.log("\nKraken:");
    console.table(krakenEnriched.map(b => ({
      currency: b.currency,
      amount: b.amount.toFixed(8),
      usdValue: `$${b.usdValue.toFixed(2)}`,
    })));

    console.log("\n🎯 Your total crypto portfolio is worth $" + totalCrypto.toFixed(2) + "!");

  } catch (error) {
    console.error("❌ Error:", error);
  }
})();