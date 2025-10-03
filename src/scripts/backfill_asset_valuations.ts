import { prisma } from '../lib/prisma';
import { subDays } from 'date-fns';

async function main() {
  console.log('🔄 Backfilling asset valuations from 24 hours ago...\n');

  const now = new Date();
  const yesterday = subDays(now, 1);
  const yesterdayDate = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate());

  console.log(`Target date: ${yesterdayDate.toISOString()}`);

  // Get all users with investment accounts
  const users = await prisma.user.findMany({
    where: {
      investmentAccounts: {
        some: {}
      }
    },
    select: {
      id: true,
      email: true
    }
  });

  console.log(`Found ${users.length} users with investment accounts\n`);

  let totalAccountsProcessed = 0;
  let totalAssetsCreated = 0;

  for (const user of users) {
    console.log(`Processing user: ${user.email}`);

    // Get all investment accounts for this user
    const investmentAccounts = await prisma.investmentAccount.findMany({
      where: { userId: user.id },
      include: {
        account: true,
        trades: {
          where: {
            occurredAt: {
              lte: yesterday
            }
          },
          orderBy: { occurredAt: 'asc' }
        }
      }
    });

    for (const account of investmentAccounts) {
      console.log(`  Account: ${account.account.name}`);

      // Calculate holdings as of yesterday
      const { calculateInvestmentAccountBalance } = await import('../lib/investment-calculations');

      const balance = await calculateInvestmentAccountBalance(
        account.id,
        account.account.openingBalance,
        account.trades.map(trade => ({
          type: trade.type,
          assetType: trade.assetType,
          symbol: trade.symbol,
          quantity: trade.quantity?.toString() || null,
          amount: trade.amount,
          fees: trade.fees
        }))
      );

      // Store asset valuations for each holding
      for (const holding of balance.holdings) {
        // Find or create the asset record
        const asset = await prisma.investmentAsset.upsert({
          where: {
            investmentAccountId_name: {
              investmentAccountId: account.id,
              name: holding.symbol
            }
          },
          create: {
            userId: user.id,
            investmentAccountId: account.id,
            name: holding.symbol,
            symbol: holding.symbol,
            type: holding.assetType
          },
          update: {
            symbol: holding.symbol,
            type: holding.assetType
          }
        });

        // Upsert the asset valuation for yesterday
        await prisma.investmentAssetValuation.upsert({
          where: {
            investmentAssetId_asOf: {
              investmentAssetId: asset.id,
              asOf: yesterdayDate
            }
          },
          create: {
            userId: user.id,
            investmentAssetId: asset.id,
            value: Math.round(holding.marketValue * 100),
            quantity: holding.quantity,
            asOf: yesterdayDate
          },
          update: {
            value: Math.round(holding.marketValue * 100),
            quantity: holding.quantity
          }
        });

        totalAssetsCreated++;
        console.log(`    ✅ ${holding.symbol}: ${holding.quantity.toFixed(8)} units @ $${(holding.marketValue / holding.quantity).toFixed(2)}`);
      }

      totalAccountsProcessed++;
    }
  }

  console.log(`\n🎉 Backfill complete!`);
  console.log(`   Processed: ${totalAccountsProcessed} accounts`);
  console.log(`   Created/Updated: ${totalAssetsCreated} asset valuations`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
