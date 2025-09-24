import "dotenv/config";

// Test the updated API endpoint directly
(async () => {
  console.log("🚀 Testing updated valuation API...\n");

  try {
    const user = { id: "cmfsjjcwi00028oj3053dwaa3" }; // Replace with actual user ID

    // Simulate the API call
    const response = await fetch("http://localhost:3000/api/investments/valuations/update", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-internal-request": "true",
        "x-user-id": user.id
      }
    });

    const result = await response.json();

    console.log("📊 API Response:");
    console.log(JSON.stringify(result, null, 2));

    if (result.success) {
      console.log(`\n✅ Updated ${result.updated} accounts:`);
      for (const account of result.results) {
        console.log(`   ${account.accountName}: $${account.newValue.toLocaleString()} (was $${account.oldValue.toLocaleString()})`);
        console.log(`     Change: $${account.change.toLocaleString()} (${account.changePercent.toFixed(2)}%)`);
      }
    }

  } catch (error) {
    console.error("❌ Error testing API:", error);
  }
})();