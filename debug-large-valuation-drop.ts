import "dotenv/config";
import { PrismaClient } from "@/generated/prisma";

const prisma = new PrismaClient();

(async () => {
  console.log("🔍 Investigating large valuation drop...\n");

  try {
    const user = await prisma.user.findFirst();
    if (!user) {
      throw new Error("No user found");
    }

    // Find the Traditional IRA account
    const iraAccount = await prisma.investmentAccount.findFirst({
      where: {
        userId: user.id,
        account: {
          name: { contains: "Traditional IRA", mode: "insensitive" }
        }
      },
      include: {
        account: true
      }
    });

    if (!iraAccount) {
      throw new Error("Traditional IRA not found");
    }

    console.log(`🏦 Account: ${iraAccount.account.name} (${iraAccount.id})`);

    // Get valuations around the values mentioned: $44,568.84 and $27,891.00
    const targetValues = [4456884, 2789100]; // In cents

    const relevantValuations = await prisma.investmentValuation.findMany({
      where: {
        investmentAccountId: iraAccount.id,
        OR: [
          { value: { gte: 4456000, lte: 4457000 } }, // Around $44,568.84
          { value: { gte: 2789000, lte: 2790000 } }, // Around $27,891.00
        ]
      },
      orderBy: { asOf: "asc" }
    });

    console.log(`\n📊 Relevant Valuations:`);
    for (const val of relevantValuations) {
      console.log(`   ${val.asOf.toISOString()}: $${(val.value / 100).toLocaleString()}`);
      console.log(`     Created: ${val.createdAt.toISOString()}`);
      console.log(`     ID: ${val.id}\n`);
    }

    // Get all valuations for Sept 22, 2025 (the date shown in the image)
    const sept22Start = new Date('2025-09-22T00:00:00Z');
    const sept22End = new Date('2025-09-22T23:59:59Z');

    const sept22Valuations = await prisma.investmentValuation.findMany({
      where: {
        investmentAccountId: iraAccount.id,
        asOf: {
          gte: sept22Start,
          lte: sept22End
        }
      },
      orderBy: { asOf: "asc" }
    });

    console.log(`\n📅 Sept 22, 2025 Valuations:`);
    for (const val of sept22Valuations) {
      console.log(`   ${val.asOf.toISOString()}: $${(val.value / 100).toLocaleString()}`);
      console.log(`     Created: ${val.createdAt.toISOString()}`);
    }

    // Check for corresponding transactions
    const adjustmentTransactions = await prisma.transaction.findMany({
      where: {
        userId: user.id,
        accountId: iraAccount.account.id,
        date: {
          gte: sept22Start,
          lte: sept22End
        },
        description: "Valuation Adjustment"
      },
      orderBy: { date: "asc" }
    });

    console.log(`\n💳 Sept 22, 2025 Valuation Adjustment Transactions:`);
    for (const tx of adjustmentTransactions) {
      console.log(`   ${tx.date.toISOString()}: ${tx.description}`);
      console.log(`     Amount: $${(tx.amount / 100).toLocaleString()}`);
      console.log(`     Reference: ${tx.reference}`);
    }

  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    await prisma.$disconnect();
  }
})();