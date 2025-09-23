#!/usr/bin/env npx tsx

import { prisma } from "../src/lib/prisma";
import { format } from "date-fns";

interface ExportOptions {
  accountName?: string;
  startDate?: Date;
  endDate?: Date;
  outputPath?: string;
  format: 'csv' | 'json';
}

async function exportHistoricalValuations(options: ExportOptions) {
  console.log("🚀 Exporting historical valuations...");

  // Get current user (assuming single user system - modify if multi-user)
  const user = await prisma.user.findFirst();
  if (!user) {
    throw new Error("No user found in database");
  }

  // Build query conditions
  const whereConditions: any = {
    userId: user.id,
  };

  if (options.startDate || options.endDate) {
    whereConditions.asOf = {};
    if (options.startDate) {
      whereConditions.asOf.gte = options.startDate;
    }
    if (options.endDate) {
      whereConditions.asOf.lte = options.endDate;
    }
  }

  if (options.accountName) {
    whereConditions.account = {
      account: {
        name: {
          contains: options.accountName,
          mode: 'insensitive'
        }
      }
    };
  }

  // Fetch valuations
  const valuations = await prisma.investmentValuation.findMany({
    where: whereConditions,
    include: {
      account: {
        include: {
          account: true
        }
      }
    },
    orderBy: [
      { account: { account: { name: 'asc' } } },
      { asOf: 'asc' }
    ]
  });

  console.log(`📊 Found ${valuations.length} valuations`);

  if (valuations.length === 0) {
    console.log("⚠️  No valuations found matching the criteria");
    return;
  }

  // Transform data
  const exportData = valuations.map(valuation => ({
    date: format(valuation.asOf, 'M/d/yyyy'), // Match original format
    accountName: valuation.account.account.name,
    value: (valuation.value / 100).toFixed(2), // Convert from cents and format
    accountId: valuation.account.account.id,
    investmentAccountId: valuation.account.id,
    createdAt: valuation.createdAt.toISOString()
  }));

  // Group by account for summary
  const accountSummary = new Map<string, { count: number, firstDate: Date, lastDate: Date, minValue: number, maxValue: number }>();

  for (const val of valuations) {
    const accountName = val.account.account.name;
    const value = val.value / 100;

    if (!accountSummary.has(accountName)) {
      accountSummary.set(accountName, {
        count: 0,
        firstDate: val.asOf,
        lastDate: val.asOf,
        minValue: value,
        maxValue: value
      });
    }

    const summary = accountSummary.get(accountName)!;
    summary.count++;
    summary.firstDate = val.asOf < summary.firstDate ? val.asOf : summary.firstDate;
    summary.lastDate = val.asOf > summary.lastDate ? val.asOf : summary.lastDate;
    summary.minValue = Math.min(summary.minValue, value);
    summary.maxValue = Math.max(summary.maxValue, value);
  }

  // Print summary
  console.log("\n📈 Export Summary by Account:");
  console.log("=" .repeat(50));
  for (const [accountName, summary] of accountSummary) {
    console.log(`${accountName}:`);
    console.log(`  📅 Date range: ${format(summary.firstDate, 'MMM d, yyyy')} - ${format(summary.lastDate, 'MMM d, yyyy')}`);
    console.log(`  📊 Records: ${summary.count}`);
    console.log(`  💰 Value range: $${summary.minValue.toLocaleString()} - $${summary.maxValue.toLocaleString()}`);
    console.log();
  }

  // Export data
  if (options.format === 'csv') {
    await exportToCSV(exportData, options.outputPath);
  } else {
    await exportToJSON(exportData, options.outputPath);
  }
}

async function exportToCSV(data: any[], outputPath?: string) {
  const fs = await import('fs/promises');

  // Generate filename if not provided
  const filename = outputPath || `valuations_export_${format(new Date(), 'yyyy-MM-dd_HH-mm-ss')}.csv`;

  // Create CSV header
  const headers = ['date', 'accountName', 'value'];
  const csvLines = [headers.join(',')];

  // Add data rows
  for (const row of data) {
    const csvRow = [
      row.date,
      `"${row.accountName}"`, // Quote account name to handle commas
      `"${row.value}"` // Quote value to match original format
    ];
    csvLines.push(csvRow.join(','));
  }

  const csvContent = csvLines.join('\n');
  await fs.writeFile(filename, csvContent, 'utf-8');

  console.log(`✅ CSV exported to: ${filename}`);
  console.log(`📋 Total records: ${data.length}`);
}

async function exportToJSON(data: any[], outputPath?: string) {
  const fs = await import('fs/promises');

  // Generate filename if not provided
  const filename = outputPath || `valuations_export_${format(new Date(), 'yyyy-MM-dd_HH-mm-ss')}.json`;

  const jsonContent = JSON.stringify(data, null, 2);
  await fs.writeFile(filename, jsonContent, 'utf-8');

  console.log(`✅ JSON exported to: ${filename}`);
  console.log(`📋 Total records: ${data.length}`);
}

// Helper to parse date strings
function parseDate(dateStr: string): Date {
  // Handle various date formats
  if (dateStr.includes('/')) {
    // M/D/YYYY or MM/DD/YYYY
    const [month, day, year] = dateStr.split('/');
    return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
  } else if (dateStr.includes('-')) {
    // YYYY-MM-DD
    return new Date(dateStr);
  } else {
    throw new Error(`Invalid date format: ${dateStr}. Use M/D/YYYY or YYYY-MM-DD`);
  }
}

// Main execution
async function main() {
  try {
    const args = process.argv.slice(2);

    if (args.length === 0) {
      console.log("Usage:");
      console.log("  npx tsx scripts/export-historical-valuations.ts [options]");
      console.log("\nOptions:");
      console.log("  --account <name>        Filter by account name (partial match)");
      console.log("  --start-date <date>     Start date (M/D/YYYY or YYYY-MM-DD)");
      console.log("  --end-date <date>       End date (M/D/YYYY or YYYY-MM-DD)");
      console.log("  --output <filename>     Output filename (default: auto-generated)");
      console.log("  --format <csv|json>     Output format (default: csv)");
      console.log("\nExamples:");
      console.log("  # Export all valuations to CSV");
      console.log("  npx tsx scripts/export-historical-valuations.ts");
      console.log("");
      console.log("  # Export Growth Fund data from 2024");
      console.log("  npx tsx scripts/export-historical-valuations.ts --account \"Growth Fund\" --start-date 1/1/2024");
      console.log("");
      console.log("  # Export to specific file");
      console.log("  npx tsx scripts/export-historical-valuations.ts --output my_valuations.csv");
      console.log("");
      console.log("  # Export as JSON");
      console.log("  npx tsx scripts/export-historical-valuations.ts --format json");
      return;
    }

    const options: ExportOptions = {
      format: 'csv'
    };

    // Parse command line arguments
    for (let i = 0; i < args.length; i++) {
      switch (args[i]) {
        case '--account':
          options.accountName = args[++i];
          break;
        case '--start-date':
          options.startDate = parseDate(args[++i]);
          break;
        case '--end-date':
          options.endDate = parseDate(args[++i]);
          break;
        case '--output':
          options.outputPath = args[++i];
          break;
        case '--format':
          const formatArg = args[++i];
          if (formatArg !== 'csv' && formatArg !== 'json') {
            throw new Error("Format must be 'csv' or 'json'");
          }
          options.format = formatArg;
          break;
        default:
          throw new Error(`Unknown option: ${args[i]}`);
      }
    }

    // Validate date range
    if (options.startDate && options.endDate && options.startDate > options.endDate) {
      throw new Error("Start date must be before end date");
    }

    console.log("📋 Export Configuration:");
    if (options.accountName) console.log(`   🏦 Account filter: ${options.accountName}`);
    if (options.startDate) console.log(`   📅 Start date: ${format(options.startDate, 'MMM d, yyyy')}`);
    if (options.endDate) console.log(`   📅 End date: ${format(options.endDate, 'MMM d, yyyy')}`);
    console.log(`   📄 Format: ${options.format.toUpperCase()}`);
    if (options.outputPath) console.log(`   📁 Output: ${options.outputPath}`);
    console.log();

    await exportHistoricalValuations(options);

  } catch (error) {
    console.error("❌ Export failed:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main();
}