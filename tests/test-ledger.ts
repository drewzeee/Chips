// Test script for account ledger functionality
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testLedgerAPI() {
  console.log("🧪 Testing Account Ledger API");
  console.log("=".repeat(50));

  try {
    // Find a user and their investment accounts
    const user = await prisma.user.findFirst({
      include: {
        investmentAccounts: {
          include: {
            account: true
          }
        }
      }
    });

    if (!user) {
      console.log("❌ No users found in database");
      return;
    }

    if (user.investmentAccounts.length === 0) {
      console.log("❌ No investment accounts found for user");
      return;
    }

    console.log(`📊 Testing with user: ${user.email}`);
    console.log(`📈 Found ${user.investmentAccounts.length} investment accounts`);

    // Test each investment account
    for (const investmentAccount of user.investmentAccounts) {
      console.log(`\n📋 Testing ledger for account: ${investmentAccount.account.name}`);

      // Test the ledger API endpoint
      const response = await fetch(`http://localhost:3000/api/investments/accounts/${investmentAccount.id}/ledger`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          // Note: In real testing, you'd need proper authentication
          // For now, this assumes the endpoint works with the session
        }
      });

      if (!response.ok) {
        console.error(`❌ API request failed: ${response.status} ${response.statusText}`);
        const errorText = await response.text();
        console.error("Response:", errorText);
        continue;
      }

      const ledger = await response.json();
      console.log("✅ Ledger data retrieved successfully:");
      console.log(`- Account: ${ledger.accountName} (${ledger.kind})`);
      console.log(`- Asset Class: ${ledger.assetClass}`);
      console.log(`- Total Value: $${ledger.totalValue.toFixed(2)}`);
      console.log(`- Cost Basis: $${ledger.totalCostBasis.toFixed(2)}`);
      console.log(`- Unrealized P&L: $${ledger.totalUnrealizedGainLoss.toFixed(2)} (${ledger.totalUnrealizedGainLossPercent.toFixed(2)}%)`);
      console.log(`- Cash Balance: $${ledger.cashPosition.balance.toFixed(2)} ${ledger.cashPosition.currency}`);
      console.log(`- Holdings: ${ledger.holdings.length} positions`);
      console.log(`- Recent Transactions: ${ledger.recentTransactions.length} records`);

      if (ledger.holdings.length > 0) {
        console.log("\n📊 Holdings breakdown:");
        for (const holding of ledger.holdings) {
          const gainLoss = holding.unrealizedGainLoss >= 0 ?
            `+$${holding.unrealizedGainLoss.toFixed(2)}` :
            `-$${Math.abs(holding.unrealizedGainLoss).toFixed(2)}`;
          const percent = holding.unrealizedGainLossPercent >= 0 ?
            `+${holding.unrealizedGainLossPercent.toFixed(2)}%` :
            `${holding.unrealizedGainLossPercent.toFixed(2)}%`;

          console.log(`  • ${holding.symbol} (${holding.assetType}): ${holding.quantity} shares @ $${holding.currentPrice.toFixed(2)}`);
          console.log(`    Market Value: $${holding.marketValue.toFixed(2)} | P&L: ${gainLoss} (${percent})`);
        }
      }

      if (ledger.recentTransactions.length > 0) {
        console.log("\n📝 Recent transactions:");
        for (const tx of ledger.recentTransactions.slice(0, 3)) {
          const date = new Date(tx.occurredAt).toLocaleDateString();
          console.log(`  • ${date}: ${tx.type} ${tx.symbol || 'Cash'} - $${(tx.amount / 100).toFixed(2)}`);
        }
      }
    }

  } catch (error) {
    console.error("❌ Test failed:", error);
  } finally {
    await prisma.$disconnect();
  }
}

// Check if server is running
console.log("Checking if development server is running...");
fetch('http://localhost:3000/api/investments/accounts', {
  method: 'HEAD'
}).then(() => {
  console.log("✅ Server is running, proceeding with test\n");
  testLedgerAPI();
}).catch(() => {
  console.log("❌ Development server not running. Start with 'npm run dev' first.");

  // Show example of expected ledger structure
  console.log("\n📋 Example Ledger Structure:");
  console.log(`
{
  "accountName": "Traditional IRA",
  "assetClass": "EQUITY",
  "kind": "BROKERAGE",
  "totalValue": 45000.00,
  "totalCostBasis": 40000.00,
  "totalUnrealizedGainLoss": 5000.00,
  "totalUnrealizedGainLossPercent": 12.5,
  "cashPosition": {
    "balance": 15000.00,
    "currency": "USD"
  },
  "holdings": [
    {
      "symbol": "NVDA",
      "assetType": "EQUITY",
      "quantity": 50,
      "averageCost": 400.00,
      "currentPrice": 450.00,
      "marketValue": 22500.00,
      "costBasis": 20000.00,
      "unrealizedGainLoss": 2500.00,
      "unrealizedGainLossPercent": 12.5
    },
    {
      "symbol": "GME",
      "assetType": "EQUITY",
      "quantity": 100,
      "averageCost": 75.00,
      "currentPrice": 85.00,
      "marketValue": 8500.00,
      "costBasis": 7500.00,
      "unrealizedGainLoss": 1000.00,
      "unrealizedGainLossPercent": 13.33
    }
  ]
}
  `);
});