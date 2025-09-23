// Test script for mixed asset valuation automation
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testMixedValuation() {
  console.log("🧪 Testing Mixed Asset Valuation Automation");
  console.log("=".repeat(50));

  try {
    // Find a user to test with
    const user = await prisma.user.findFirst();
    if (!user) {
      console.log("❌ No users found in database");
      return;
    }

    console.log(`📊 Testing with user: ${user.email}`);

    // Test the valuation update endpoint (simulating internal request)
    const response = await fetch('http://localhost:3000/api/investments/valuations/update', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-internal-request': 'true',
        'x-user-id': user.id
      }
    });

    if (!response.ok) {
      console.error(`❌ API request failed: ${response.status} ${response.statusText}`);
      const errorText = await response.text();
      console.error("Response:", errorText);
      return;
    }

    const result = await response.json();
    console.log("\n✅ Valuation automation result:");
    console.log(`- Success: ${result.success}`);
    console.log(`- Processed: ${result.processed} accounts`);
    console.log(`- Updated: ${result.updated} valuations`);

    if (result.errors && result.errors.length > 0) {
      console.log("⚠️ Errors:");
      result.errors.forEach((error: string) => console.log(`  - ${error}`));
    }

    if (result.results && result.results.length > 0) {
      console.log("\n📈 Valuation Results:");
      result.results.forEach((r: any) => {
        console.log(`- ${r.accountName}: ${r.assetSymbol}`);
        console.log(`  Quantity: ${r.quantity}`);
        console.log(`  Price: $${r.pricePerUnit.toFixed(2)}`);
        console.log(`  Value: $${r.newValue.toFixed(2)} (was $${r.oldValue.toFixed(2)})`);
        console.log(`  Change: ${r.change >= 0 ? '+' : ''}$${r.change.toFixed(2)} (${r.changePercent.toFixed(2)}%)`);
        console.log("");
      });
    }

  } catch (error) {
    console.error("❌ Test failed:", error);
  } finally {
    await prisma.$disconnect();
  }
}

// Only run if server is available
console.log("Checking if development server is running...");
fetch('http://localhost:3000/api/investments/valuations/update', {
  method: 'HEAD'
}).then(() => {
  console.log("✅ Server is running, proceeding with test\n");
  testMixedValuation();
}).catch(() => {
  console.log("❌ Development server not running. Start with 'npm run dev' first.");
});