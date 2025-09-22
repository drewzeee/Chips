#!/usr/bin/env tsx
import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import Papa from 'papaparse';

interface AccountMapping {
  filename: string;
  accountId: string;
  name: string;
}

// Account mappings - customize these based on your database account IDs
const ACCOUNT_MAPPINGS: AccountMapping[] = [
  { filename: 'AllySavings.csv', accountId: 'your-ally-savings-id', name: 'Ally Savings' },
  { filename: 'FreedomCC.csv', accountId: 'your-freedom-cc-id', name: 'Freedom Credit Card' },
  { filename: 'TotalChecking.csv', accountId: 'your-total-checking-id', name: 'Total Checking' },
  { filename: 'SapphireCC.csv', accountId: 'your-sapphire-cc-id', name: 'Sapphire Credit Card' },
  { filename: 'BusinessSavings.csv', accountId: 'your-business-savings-id', name: 'Business Savings' },
  { filename: 'AllySpending.csv', accountId: 'your-ally-spending-id', name: 'Ally Spending' },
  { filename: 'Ink_Unlimited.csv', accountId: 'your-ink-unlimited-id', name: 'Ink Unlimited' },
];

const TXS_DIR = './txs';
const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000';
const AUTH_TOKEN = process.env.AUTH_TOKEN; // JWT token for authentication

interface TransactionRow {
  date: string;
  amount: number;
  description: string;
  merchant?: string;
  reference?: string;
  categoryId?: string;
}

function parseCSV(filePath: string): TransactionRow[] {
  const content = readFileSync(filePath, 'utf-8');
  const result = Papa.parse(content, {
    header: true,
    dynamicTyping: true,
    skipEmptyLines: true
  });

  return result.data.map((row: any) => ({
    date: row.Date || row.date,
    amount: parseFloat(row.Amount || row.amount),
    description: row.Description || row.description,
    merchant: row.Merchant || row.merchant,
    reference: row.Reference || row.reference,
  })).filter(row => row.date && !isNaN(row.amount));
}

async function importTransactions(accountId: string, transactions: TransactionRow[]) {
  const payload = {
    accountId,
    rows: transactions
  };

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (AUTH_TOKEN) {
    headers['Authorization'] = `Bearer ${AUTH_TOKEN}`;
  }

  const response = await fetch(`${API_BASE_URL}/api/import`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error(`Import failed: ${response.status} ${response.statusText}`);
  }

  return await response.json();
}

function getFilesModifiedToday(dirPath: string): string[] {
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];

  const files: string[] = [];

  function scanDirectory(dir: string) {
    const items = readdirSync(dir);

    for (const item of items) {
      const fullPath = join(dir, item);
      const stat = statSync(fullPath);

      if (stat.isDirectory()) {
        scanDirectory(fullPath);
      } else if (item.endsWith('.csv')) {
        const modifiedDate = stat.mtime.toISOString().split('T')[0];
        if (modifiedDate === todayStr) {
          files.push(fullPath);
        }
      }
    }
  }

  scanDirectory(dirPath);
  return files;
}

async function main() {
  try {
    console.log('🔍 Scanning for transaction files modified today...');

    const modifiedFiles = getFilesModifiedToday(TXS_DIR);

    if (modifiedFiles.length === 0) {
      console.log('No transaction files modified today. Exiting.');
      return;
    }

    console.log(`Found ${modifiedFiles.length} modified files:`);
    modifiedFiles.forEach(file => console.log(`  - ${file}`));

    for (const filePath of modifiedFiles) {
      const filename = filePath.split('/').pop()!;
      const mapping = ACCOUNT_MAPPINGS.find(m => m.filename === filename);

      if (!mapping) {
        console.warn(`⚠️  No account mapping found for ${filename}, skipping...`);
        continue;
      }

      console.log(`\n📊 Processing ${mapping.name} (${filename})...`);

      try {
        const transactions = parseCSV(filePath);

        if (transactions.length === 0) {
          console.log(`  No transactions found in ${filename}`);
          continue;
        }

        console.log(`  Found ${transactions.length} transactions`);

        // Dry run first to check for duplicates
        const dryRunResult = await fetch(`${API_BASE_URL}/api/import?dryRun=true`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(AUTH_TOKEN ? { 'Authorization': `Bearer ${AUTH_TOKEN}` } : {})
          },
          body: JSON.stringify({
            accountId: mapping.accountId,
            rows: transactions
          })
        });

        if (!dryRunResult.ok) {
          throw new Error(`Dry run failed: ${dryRunResult.status}`);
        }

        const dryRun = await dryRunResult.json();
        console.log(`  Dry run: ${dryRun.importable} new, ${dryRun.duplicates} duplicates`);

        if (dryRun.importable === 0) {
          console.log(`  All transactions already imported, skipping...`);
          continue;
        }

        // Actual import
        const result = await importTransactions(mapping.accountId, transactions);
        console.log(`  ✅ Imported ${result.imported} transactions (${result.duplicates} duplicates skipped)`);

      } catch (error) {
        console.error(`  ❌ Error processing ${filename}:`, error);
      }
    }

    console.log('\n🎉 Transaction import completed!');

  } catch (error) {
    console.error('❌ Import process failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}