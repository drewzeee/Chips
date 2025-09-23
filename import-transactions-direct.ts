#!/usr/bin/env tsx
import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import Papa from 'papaparse';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface Config {
  accountMappings: Array<{
    filename: string;
    accountId: string;
    name: string;
    type: string;
  }>;
  settings: {
    txsDirectory: string;
    apiBaseUrl: string;
    enableDryRun: boolean;
    logLevel: string;
  };
}

function loadConfig(): Config {
  try {
    const content = readFileSync('./account-config.json', 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    console.error('❌ Could not load account-config.json:', error);
    console.log('💡 Run "tsx configure-accounts-direct.ts auto" to set up configuration');
    process.exit(1);
  }
}

interface TransactionRow {
  date: string;
  amount: number;
  description: string;
  merchant?: string;
  reference?: string;
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

function normalizeKey(date: Date, amount: number, description: string) {
  return `${date.toISOString().slice(0, 10)}|${amount}|${description.trim().toLowerCase()}`;
}

async function importTransactions(accountId: string, transactions: TransactionRow[], dryRun: boolean = false) {
  const rows = transactions.map((row) => ({
    ...row,
    date: new Date(row.date),
  }));

  const minDate = new Date(Math.min(...rows.map((row) => row.date.getTime())));
  const maxDate = new Date(Math.max(...rows.map((row) => row.date.getTime())));

  const rangeStart = new Date(minDate);
  rangeStart.setHours(0, 0, 0, 0);

  const rangeEnd = new Date(maxDate);
  rangeEnd.setHours(23, 59, 59, 999);

  // Check for existing transactions
  const existing = await prisma.transaction.findMany({
    where: {
      accountId,
      date: {
        gte: rangeStart,
        lte: rangeEnd,
      },
    },
    select: {
      id: true,
      date: true,
      amount: true,
      description: true,
    },
  });

  const existingSet = new Set(
    existing.map((item) => normalizeKey(item.date, item.amount, item.description))
  );

  const duplicates: typeof rows = [];
  const uniqueRows = [] as typeof rows;

  for (const row of rows) {
    const key = normalizeKey(row.date, row.amount, row.description);
    if (existingSet.has(key)) {
      duplicates.push(row);
    } else {
      uniqueRows.push(row);
    }
  }

  if (dryRun) {
    return {
      duplicates: duplicates.length,
      importable: uniqueRows.length,
      total: rows.length,
    };
  }

  if (uniqueRows.length === 0) {
    return { imported: 0, duplicates: duplicates.length };
  }

  const importTag = `import_${Date.now()}`;

  // Import new transactions
  const createdTransactions = await prisma.$transaction(async (tx) => {
    const created = [];
    for (const row of uniqueRows) {
      const transaction = await tx.transaction.create({
        data: {
          // You'll need to get the userId - either from env or find the first user
          userId: process.env.USER_ID || (await tx.user.findFirst())?.id || 'default-user-id',
          accountId,
          date: row.date,
          amount: row.amount,
          description: row.description,
          merchant: row.merchant ?? null,
          reference: row.reference ?? null,
          status: "CLEARED",
          pending: false,
          importTag,
        },
      });
      created.push(transaction);
    }
    return created;
  });

  return {
    imported: createdTransactions.length,
    duplicates: duplicates.length,
    importTag,
  };
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
    const config = loadConfig();

    console.log('🔍 Scanning for transaction files modified today...');

    const modifiedFiles = getFilesModifiedToday(config.settings.txsDirectory);

    if (modifiedFiles.length === 0) {
      console.log('No transaction files modified today. Exiting.');
      return;
    }

    console.log(`Found ${modifiedFiles.length} modified files:`);
    modifiedFiles.forEach(file => console.log(`  - ${file}`));

    for (const filePath of modifiedFiles) {
      const filename = filePath.split('/').pop()!;
      const mapping = config.accountMappings.find(m => m.filename === filename);

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
        const dryRun = await importTransactions(mapping.accountId, transactions, true);
        console.log(`  Dry run: ${dryRun.importable} new, ${dryRun.duplicates} duplicates`);

        if (dryRun.importable === 0) {
          console.log(`  All transactions already imported, skipping...`);
          continue;
        }

        // Actual import
        const result = await importTransactions(mapping.accountId, transactions, false);
        console.log(`  ✅ Imported ${result.imported} transactions (${result.duplicates} duplicates skipped)`);

      } catch (error) {
        console.error(`  ❌ Error processing ${filename}:`, error);
      }
    }

    console.log('\n🎉 Transaction import completed!');

  } catch (error) {
    console.error('❌ Import process failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main();
}