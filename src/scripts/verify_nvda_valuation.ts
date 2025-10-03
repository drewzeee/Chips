import { prisma } from '../lib/prisma';
import { subDays } from 'date-fns';

async function main() {
  const now = new Date();
  const yesterday = subDays(now, 1);
  const yesterdayDate = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate());

  console.log('🔍 Verifying NVDA valuation from yesterday\n');
  console.log(`Target date: ${yesterdayDate.toISOString()}\n`);

  // Find NVDA asset
  const nvdaAssets = await prisma.investmentAsset.findMany({
    where: {
      symbol: 'NVDA'
    },
    include: {
      account: {
        include: {
          account: true
        }
      },
      valuations: {
        where: {
          asOf: yesterdayDate
        }
      },
      transactions: {
        where: {
          occurredAt: {
            lte: yesterday
          }
        },
        orderBy: { occurredAt: 'asc' }
      }
    }
  });

  if (nvdaAssets.length === 0) {
    console.log('❌ No NVDA assets found');
    return;
  }

  for (const asset of nvdaAssets) {
    console.log(`Account: ${asset.account.account.name}`);
    console.log(`Asset ID: ${asset.id}`);
    
    // Show all transactions up to yesterday
    console.log('\nTransactions up to yesterday:');
    for (const tx of asset.transactions) {
      console.log(`  ${tx.occurredAt.toISOString()} - ${tx.type}: ${tx.quantity} @ $${tx.pricePerUnit} = $${tx.amount / 100}`);
    }

    // Calculate quantity from transactions
    let totalQuantity = 0;
    for (const tx of asset.transactions) {
      if (tx.type === 'BUY') {
        totalQuantity += Number(tx.quantity || 0);
      } else if (tx.type === 'SELL') {
        totalQuantity -= Number(tx.quantity || 0);
      }
    }
    console.log(`\nCalculated quantity: ${totalQuantity}`);

    // Show stored valuation
    if (asset.valuations.length > 0) {
      const val = asset.valuations[0];
      console.log(`\nStored valuation for ${yesterdayDate.toISOString().split('T')[0]}:`);
      console.log(`  Value: $${val.value / 100}`);
      console.log(`  Quantity: ${val.quantity}`);
      console.log(`  Price per unit: $${(val.value / Number(val.quantity || 1)) / 100}`);
    } else {
      console.log('\n❌ No valuation found for yesterday');
    }

    // Fetch current NVDA price to compare
    const { fetchAllAssetPrices } = await import('../lib/asset-prices');
    const priceData = await fetchAllAssetPrices([{
      symbol: 'NVDA',
      assetType: 'EQUITY',
      quantity: totalQuantity
    }]);

    const currentPrice = priceData.stockPrices['NVDA'];
    console.log(`\nCurrent NVDA price: $${currentPrice}`);
    console.log(`Current total value: $${currentPrice * totalQuantity}`);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
