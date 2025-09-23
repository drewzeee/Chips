// Debug script for Gemini account specifically
import { prisma } from '../src/lib/prisma';

async function debugGeminiAccount() {
  console.log("🔍 Debugging Gemini Account");
  console.log("=".repeat(50));

  try {
    // Find the Gemini account
    const geminiAccount = await prisma.investmentAccount.findFirst({
      where: {
        account: {
          name: 'Gemini'
        }
      },
      include: {
        account: true,
        trades: {
          orderBy: { occurredAt: 'asc' }
        }
      }
    });

    if (!geminiAccount) {
      console.log("❌ Gemini account not found");
      return;
    }

    console.log("📊 Gemini Account Details:");
    console.log(`- Account ID: ${geminiAccount.id}`);
    console.log(`- Opening Balance: $${(geminiAccount.account.openingBalance / 100).toFixed(2)}`);
    console.log(`- Total Trades: ${geminiAccount.trades.length}`);

    console.log("\n📝 All Transactions:");
    let runningBalance = geminiAccount.account.openingBalance / 100;
    console.log(`Starting balance: $${runningBalance.toFixed(2)}`);

    for (const trade of geminiAccount.trades) {
      const amount = trade.amount / 100; // Convert cents to dollars
      console.log(`\n${trade.occurredAt.toISOString().split('T')[0]}: ${trade.type}`);
      console.log(`- Amount: $${amount.toFixed(2)}`);
      console.log(`- Fees: ${trade.fees ? '$' + (trade.fees / 100).toFixed(2) : 'None'}`);
      console.log(`- Symbol: ${trade.symbol || 'N/A'}`);
      console.log(`- Asset Type: ${trade.assetType || 'N/A'}`);
      console.log(`- Quantity: ${trade.quantity || 'N/A'}`);
      console.log(`- Notes: ${trade.notes || 'N/A'}`);

      // Show how this affects the running balance
      if (trade.type === 'WITHDRAW') {
        runningBalance -= amount;
        console.log(`- Balance after withdrawal: $${runningBalance.toFixed(2)}`);
      } else if (trade.type === 'DEPOSIT') {
        runningBalance += amount;
        console.log(`- Balance after deposit: $${runningBalance.toFixed(2)}`);
      }
    }

    console.log(`\n💰 Expected Final Balance: $${runningBalance.toFixed(2)}`);

  } catch (error) {
    console.error("❌ Debug failed:", error);
  } finally {
    await prisma.$disconnect();
  }
}

debugGeminiAccount();