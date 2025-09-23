#!/usr/bin/env npx tsx

import { prisma } from "../src/lib/prisma";
import { upsertInvestmentAccountValuation } from "../src/app/api/investments/helpers";

interface HistoricalValuation {
  date: string; // YYYY-MM-DD format
  accountName: string; // Name of the investment account
  value: number; // Value in dollars (will be converted to cents)
}

// Example data format - replace with your actual data
const exampleData: HistoricalValuation[] = [
  {
    date: "2024-01-01",
    accountName: "My Brokerage Account",
    value: 100000.00
  },
  {
    date: "2024-02-01",
    accountName: "My Brokerage Account",
    value: 105000.00
  },
  // Add more historical data points here...
];

async function importHistoricalValuations(data: HistoricalValuation[], overwrite: boolean = false) {
  console.log(`Starting import of ${data.length} historical valuations...`);
  if (overwrite) {
    console.log(`⚠️  Overwrite mode enabled - existing valuations will be replaced`);
  }

  // Get current user (assuming single user system - modify if multi-user)
  const user = await prisma.user.findFirst();
  if (!user) {
    throw new Error("No user found in database");
  }

  let imported = 0;
  let updated = 0;
  let skipped = 0;
  let errors = 0;

  for (const valuation of data) {
    try {
      console.log(`Processing ${valuation.accountName} on ${valuation.date}...`);

      // Find the investment account by name
      const investmentAccount = await prisma.investmentAccount.findFirst({
        where: {
          userId: user.id,
          account: {
            name: valuation.accountName
          }
        },
        include: {
          account: true
        }
      });

      if (!investmentAccount) {
        console.warn(`⚠️  Investment account "${valuation.accountName}" not found. Skipping.`);
        skipped++;
        continue;
      }

      // Check if valuation already exists for this date
      const existingValuation = await prisma.investmentValuation.findUnique({
        where: {
          investmentAccountId_asOf: {
            investmentAccountId: investmentAccount.id,
            asOf: new Date(valuation.date)
          }
        }
      });

      if (existingValuation && !overwrite) {
        console.log(`⚠️  Valuation for ${valuation.accountName} on ${valuation.date} already exists. Skipping (use --overwrite to replace).`);
        skipped++;
        continue;
      }

      // Use transaction to ensure data consistency
      await prisma.$transaction(async (tx) => {
        await upsertInvestmentAccountValuation({
          tx,
          userId: user.id,
          investmentAccountId: investmentAccount.id,
          financialAccountId: investmentAccount.account.id,
          openingBalance: investmentAccount.account.openingBalance,
          asOf: new Date(valuation.date),
          value: Math.round(valuation.value * 100) // Convert to cents
        });
      });

      if (existingValuation) {
        console.log(`🔄 Updated valuation for ${valuation.accountName} on ${valuation.date}: $${valuation.value.toLocaleString()}`);
        updated++;
      } else {
        console.log(`✅ Imported valuation for ${valuation.accountName} on ${valuation.date}: $${valuation.value.toLocaleString()}`);
        imported++;
      }

    } catch (error) {
      console.error(`❌ Error processing ${valuation.accountName} on ${valuation.date}:`, error);
      errors++;
    }
  }

  console.log(`\n📊 Import Summary:`);
  console.log(`   ✅ Imported: ${imported}`);
  console.log(`   🔄 Updated: ${updated}`);
  console.log(`   ⚠️  Skipped: ${skipped}`);
  console.log(`   ❌ Errors: ${errors}`);
  console.log(`   📋 Total: ${data.length}`);
}

// Function to import from CSV format
async function importFromCSV(csvFilePath: string) {
  const fs = await import('fs/promises');
  const csvContent = await fs.readFile(csvFilePath, 'utf-8');

  const lines = csvContent.trim().split('\n');
  const headers = lines[0].split(',').map(h => h.trim());

  // Expected headers: date,accountName,value
  const dateIndex = headers.findIndex(h => h.toLowerCase().includes('date'));
  const accountIndex = headers.findIndex(h => h.toLowerCase().includes('account'));
  const valueIndex = headers.findIndex(h => h.toLowerCase().includes('value'));

  if (dateIndex === -1 || accountIndex === -1 || valueIndex === -1) {
    throw new Error('CSV must have columns for date, account name, and value');
  }

  const data: HistoricalValuation[] = lines.slice(1)
    .filter(line => line.trim()) // Skip empty lines
    .map(line => {
      // Parse CSV line properly handling quoted values with commas
      const columns = parseCSVLine(line);

      const dateStr = columns[dateIndex]?.trim();
      const accountName = columns[accountIndex]?.trim();
      const valueStr = columns[valueIndex]?.trim();

      if (!dateStr || !accountName || !valueStr) {
        throw new Error(`Invalid row: ${line}`);
      }

      // Convert M/D/YYYY to YYYY-MM-DD format
      const formattedDate = convertDateFormat(dateStr);

      // Remove commas and quotes from value, then parse
      const cleanValue = valueStr.replace(/[,"]/g, '');
      const value = parseFloat(cleanValue);

      if (isNaN(value)) {
        throw new Error(`Invalid value "${valueStr}" in row: ${line}`);
      }

      return {
        date: formattedDate,
        accountName,
        value
      };
    });

  return data;
}

// Helper function to parse CSV lines with proper quote handling
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  result.push(current.trim());
  return result;
}

// Helper function to convert M/D/YYYY to YYYY-MM-DD
function convertDateFormat(dateStr: string): string {
  const [month, day, year] = dateStr.split('/');
  const paddedMonth = month.padStart(2, '0');
  const paddedDay = day.padStart(2, '0');
  return `${year}-${paddedMonth}-${paddedDay}`;
}

// Main execution
async function main() {
  try {
    const args = process.argv.slice(2);

    if (args.length === 0) {
      console.log("Usage:");
      console.log("  npx tsx scripts/import-historical-valuations.ts --example [--overwrite]");
      console.log("  npx tsx scripts/import-historical-valuations.ts --csv /path/to/file.csv [--overwrite]");
      console.log("\nFlags:");
      console.log("  --overwrite: Replace existing valuations for the same date");
      console.log("\nExample CSV format:");
      console.log("date,accountName,value");
      console.log("5/1/2022,Growth Fund,\"70,605.52\"");
      console.log("5/2/2022,Growth Fund,\"73,474.51\"");
      return;
    }

    const overwrite = args.includes('--overwrite');
    const filteredArgs = args.filter(arg => arg !== '--overwrite');

    if (filteredArgs[0] === '--example') {
      console.log("🚀 Importing example data...");
      await importHistoricalValuations(exampleData, overwrite);
    } else if (filteredArgs[0] === '--csv' && filteredArgs[1]) {
      console.log(`🚀 Importing from CSV: ${filteredArgs[1]}`);
      const data = await importFromCSV(filteredArgs[1]);
      await importHistoricalValuations(data, overwrite);
    } else {
      throw new Error("Invalid arguments. Use --example or --csv /path/to/file.csv");
    }

  } catch (error) {
    console.error("❌ Import failed:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main();
}