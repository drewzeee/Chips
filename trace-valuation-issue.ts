import "dotenv/config";
import { PrismaClient } from "@/generated/prisma";

const prisma = new PrismaClient();

(async () => {
  console.log("🔍 Tracing the valuation drop issue...\n");

  try {
    const user = await prisma.user.findFirst();
    if (!user) {
      throw new Error("No user found");
    }

    // Get the specific valuation records that caused the issue
    const problematicValuation = await prisma.investmentValuation.findUnique({
      where: { id: "cmfugzubw00jl8oc0f753b51n" }
    });

    if (problematicValuation) {
      console.log("❌ Problematic Valuation Record:");
      console.log(`   ID: ${problematicValuation.id}`);
      console.log(`   Value: $${(problematicValuation.value / 100).toLocaleString()}`);
      console.log(`   As Of: ${problematicValuation.asOf.toISOString()}`);
      console.log(`   Created: ${problematicValuation.createdAt.toISOString()}\n`);
    }

    // Get the transaction that caused the -$26,691.23 adjustment
    const problematicTransaction = await prisma.transaction.findFirst({
      where: {
        reference: "investment_valuation_cmfugzubw00jl8oc0f753b51n"
      }
    });

    if (problematicTransaction) {
      console.log("💸 Problematic Transaction:");
      console.log(`   Amount: $${(problematicTransaction.amount / 100).toLocaleString()}`);
      console.log(`   Date: ${problematicTransaction.date.toISOString()}`);
      console.log(`   Description: ${problematicTransaction.description}`);
      console.log(`   Reference: ${problematicTransaction.reference}\n`);
    }

    // Get the Traditional IRA account info
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

    // Get the timeline around Sept 22-23, 2025
    console.log("📅 Timeline of Events:");

    const timelineStart = new Date('2025-09-22T00:00:00Z');
    const timelineEnd = new Date('2025-09-23T23:59:59Z');

    const timelineEvents = await prisma.investmentValuation.findMany({
      where: {
        investmentAccountId: iraAccount.id,
        asOf: {
          gte: timelineStart,
          lte: timelineEnd
        }
      },
      orderBy: { asOf: "asc" }
    });

    for (const event of timelineEvents) {
      console.log(`   ${event.asOf.toISOString()}: $${(event.value / 100).toLocaleString()}`);
      console.log(`     Created: ${event.createdAt.toISOString()}`);
      console.log(`     Valuation ID: ${event.id}`);

      // Find the associated transaction
      const associatedTx = await prisma.transaction.findFirst({
        where: { reference: `investment_valuation_${event.id}` }
      });

      if (associatedTx) {
        console.log(`     → Generated transaction: $${(associatedTx.amount / 100).toLocaleString()} on ${associatedTx.date.toISOString()}`);
      }
      console.log("");
    }

    // Check if there are multiple valuations with the same problematic ID reference
    const duplicateValuations = await prisma.investmentValuation.findMany({
      where: {
        id: "cmfugzubw00jl8oc0f753b51n"
      }
    });

    console.log(`🔍 Duplicate check: Found ${duplicateValuations.length} records with that ID`);

  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    await prisma.$disconnect();
  }
})();