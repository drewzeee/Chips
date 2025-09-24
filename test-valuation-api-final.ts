import "dotenv/config";

// Test the final updated valuation API
(async () => {
  console.log("🚀 Testing final updated valuation API...\n");

  try {
    // Test with manual call to see the output format
    const userId = "cmfsjjcwi00028oj3053dwaa3"; // Get actual user ID

    console.log("Making API call to update valuations...");

    const response = await fetch("http://localhost:3000/api/investments/valuations/update", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-internal-request": "true",
        "x-user-id": userId
      }
    });

    if (!response.ok) {
      throw new Error(`API responded with status: ${response.status}`);
    }

    const result = await response.json();

    console.log("📊 API Response:");
    console.log(`Success: ${result.success}`);
    console.log(`Processed: ${result.processed} accounts`);
    console.log(`Updated: ${result.updated} accounts`);

    if (result.results && result.results.length > 0) {
      console.log("\n🎯 Updated Accounts:");
      for (const account of result.results) {
        console.log(`   ${account.accountName}:`);
        console.log(`     ${account.assetSymbol}`);
        console.log(`     New Value: $${account.newValue.toLocaleString()}`);
        console.log(`     Previous: $${account.oldValue.toLocaleString()}`);
        console.log(`     Change: $${account.change.toLocaleString()} (${account.changePercent.toFixed(2)}%)`);
      }
    }

    if (result.errors && result.errors.length > 0) {
      console.log("\n❌ Errors:");
      for (const error of result.errors) {
        console.log(`   ${error}`);
      }
    }

    console.log("\n✅ Test completed successfully!");

  } catch (error) {
    console.error("❌ Error testing API:", error);
  }
})();