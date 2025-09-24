#!/usr/bin/env tsx

import fs from 'fs/promises';
import path from 'path';
import Papa from 'papaparse';
import { parse } from 'date-fns';
import { parseAmountToCents } from '@/lib/utils';
import { prisma } from '@/lib/prisma';

interface ImportConfig {
  accounts: Record<string, {
    templateName: string;
    accountId: string;
    notes: string;
  }>;
  settings: {
    autoProcessNew: boolean;
    backupProcessed: boolean;
    processedDir: string;
    errorDir: string;
    dryRunFirst: boolean;
    maxDuplicates: number;
  };
}

interface ImportTemplate {
  id: string;
  name: string;
  mappings: {
    date: string;
    description: string;
    amount: string;
    merchant?: string;
    reference?: string;
    dateFormat?: string;
  };
}

interface PreparedRow {
  date: string;
  description: string;
  amount: number;
  merchant?: string | null;
  reference?: string | null;
  categoryId?: string | null;
}

class CSVImportAutomation {
  private config!: ImportConfig;
  private templates: Map<string, ImportTemplate> = new Map();
  private userId: string;

  constructor(configPath: string, userId: string) {
    this.userId = userId;
  }

  private async loadConfig(configPath: string): Promise<void> {
    try {
      const configData = await fs.readFile(configPath, 'utf-8');
      this.config = JSON.parse(configData);
    } catch (error: any) {
      throw new Error(`Failed to load config from ${configPath}: ${error}`);
    }
  }

  private async loadTemplates(): Promise<void> {
    const templates = await prisma.importTemplate.findMany({
      where: { userId: this.userId },
    });

    for (const template of templates) {
      let mappings;
      try {
        mappings = JSON.parse(template.mappings);
      } catch (error) {
        console.warn(`Failed to parse mappings for template ${template.name}:`, error);
        continue;
      }

      this.templates.set(template.name, {
        id: template.id,
        name: template.name,
        mappings: {
          date: mappings.date ?? '',
          description: mappings.description ?? '',
          amount: mappings.amount ?? '',
          merchant: mappings.merchant,
          reference: mappings.reference,
          dateFormat: mappings.dateFormat,
        },
      });
    }
  }

  private async ensureDirectories(): Promise<void> {
    try {
      await fs.mkdir(this.config.settings.processedDir, { recursive: true });
      await fs.mkdir(this.config.settings.errorDir, { recursive: true });
    } catch (error) {
      console.warn('Failed to create directories:', error);
    }
  }

  private getAccountKeyFromFilename(filename: string): string | null {
    const baseName = path.basename(filename, '.csv');
    return Object.keys(this.config.accounts).find(key => baseName.includes(key)) || null;
  }

  private async parseCSV(filePath: string): Promise<Record<string, string>[]> {
    const fileContent = await fs.readFile(filePath, 'utf-8');

    return new Promise((resolve, reject) => {
      Papa.parse<Record<string, string>>(fileContent, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          const data = results.data.filter((row) =>
            Object.values(row).some((value) => value && value.trim() !== '')
          );
          resolve(data);
        },
        error: (error: Error) => {
          reject(new Error(`Failed to parse CSV: ${error.message}`));
        },
      });
    });
  }

  private prepareRows(rawRows: Record<string, string>[], template: ImportTemplate): PreparedRow[] {
    const { mappings } = template;
    const prepared: PreparedRow[] = [];

    for (const row of rawRows) {
      const dateInput = row[mappings.date];
      const description = row[mappings.description]?.trim();
      const amountInput = row[mappings.amount];

      if (!dateInput || !description || !amountInput) {
        continue;
      }

      // Parse date
      let parsedDate = new Date(dateInput);
      if (Number.isNaN(parsedDate.getTime()) && mappings.dateFormat) {
        parsedDate = parse(dateInput, mappings.dateFormat, new Date());
      }

      if (Number.isNaN(parsedDate.getTime())) {
        console.warn(`Invalid date: ${dateInput} in row:`, row);
        continue;
      }

      // Parse amount to cents (same as UI does)
      const amount = parseAmountToCents(amountInput);
      if (!Number.isFinite(amount) || amount === 0) {
        console.warn(`Invalid amount: ${amountInput} in row:`, row);
        continue;
      }

      prepared.push({
        date: parsedDate.toISOString(),
        description,
        amount,
        merchant: mappings.merchant ? row[mappings.merchant] ?? null : null,
        reference: mappings.reference ? row[mappings.reference] ?? null : null,
        categoryId: null,
      });
    }

    return prepared;
  }

  private async importRows(accountId: string, rows: PreparedRow[], dryRun: boolean = false): Promise<any> {
    const automationKey = process.env.AUTOMATION_KEY || "change-me-in-production";
    const apiUrl = process.env.API_URL || "http://localhost:3000";

    const response = await fetch(`${apiUrl}/api/automation/import${dryRun ? '?dryRun=true' : ''}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Automation-Key': automationKey,
        'X-User-Id': this.userId,
      },
      body: JSON.stringify({
        accountId,
        rows,
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => null);
      throw new Error(error?.error ?? `Import failed with status ${response.status}`);
    }

    return response.json();
  }

  private async createLogFile(srcPath: string, destDir: string, status: 'success' | 'error', details?: any): Promise<void> {
    const filename = path.basename(srcPath);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const logFilename = `${timestamp}_${filename.replace('.csv', '')}.log`;
    const logPath = path.join(destDir, logFilename);

    const logContent = {
      timestamp: new Date().toISOString(),
      filename,
      filePath: srcPath,
      status,
      details
    };

    try {
      await fs.writeFile(logPath, JSON.stringify(logContent, null, 2));
      console.log(`Created log file: ${logPath}`);
    } catch (error) {
      console.warn(`Failed to create log file for ${filename}:`, error);
    }
  }

  async processFile(filePath: string): Promise<void> {
    const filename = path.basename(filePath);
    console.log(`Processing ${filename}...`);

    try {
      // Determine account from filename
      const accountKey = this.getAccountKeyFromFilename(filename);
      if (!accountKey) {
        throw new Error(`No account configuration found for filename: ${filename}`);
      }

      const accountConfig = this.config.accounts[accountKey];
      console.log(`Matched to account: ${accountKey} using template: ${accountConfig.templateName}`);

      // Get template
      const template = this.templates.get(accountConfig.templateName);
      if (!template) {
        throw new Error(`Template not found: ${accountConfig.templateName}`);
      }

      // Parse CSV
      const rawRows = await this.parseCSV(filePath);
      console.log(`Parsed ${rawRows.length} rows from CSV`);

      // Prepare data
      const preparedRows = this.prepareRows(rawRows, template);
      console.log(`Prepared ${preparedRows.length} valid rows for import`);

      if (preparedRows.length === 0) {
        throw new Error('No valid rows to import');
      }

      // Dry run first if enabled
      if (this.config.settings.dryRunFirst) {
        console.log('Running dry run...');
        const dryRunResult = await this.importRows(accountConfig.accountId, preparedRows, true);
        console.log(`Dry run results:`, dryRunResult);

        if (dryRunResult.duplicates > this.config.settings.maxDuplicates) {
          throw new Error(`Too many duplicates (${dryRunResult.duplicates}), max allowed: ${this.config.settings.maxDuplicates}`);
        }
      }

      // Actual import
      console.log('Importing transactions...');
      const result = await this.importRows(accountConfig.accountId, preparedRows, false);
      console.log(`Import completed:`, result);

      // Create success log
      await this.createLogFile(filePath, this.config.settings.processedDir, 'success', result);

    } catch (error) {
      console.error(`Error processing ${filename}:`, error);

      // Create error log
      await this.createLogFile(filePath, this.config.settings.errorDir, 'error', { error: error.message });
      throw error;
    }
  }

  async processDirectory(txsDir: string, configPath: string): Promise<void> {
    await this.loadConfig(configPath);
    await this.loadTemplates();
    await this.ensureDirectories();

    console.log(`Scanning ${txsDir} for CSV files...`);

    const scan = async (dir: string): Promise<string[]> => {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      const files: string[] = [];

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          files.push(...await scan(fullPath));
        } else if (entry.name.endsWith('.csv')) {
          files.push(fullPath);
        }
      }

      return files;
    };

    const csvFiles = await scan(txsDir);
    console.log(`Found ${csvFiles.length} CSV files`);

    for (const filePath of csvFiles) {
      try {
        await this.processFile(filePath);
      } catch (error) {
        console.error(`Failed to process ${filePath}:`, error);
        // Continue with other files
      }
    }
  }
}

// CLI Usage
async function main() {
  const args = process.argv.slice(2);
  const txsDir = args[0] || './txs';
  const configPath = args[1] || './import-config.json';
  const userId = args[2];

  if (!userId) {
    console.error('Usage: tsx import-automation.ts <txsDir> <configPath> <userId>');
    console.error('Example: tsx import-automation.ts ./txs ./import-config.json user-id-123');
    process.exit(1);
  }

  try {
    const automation = new CSVImportAutomation(configPath, userId);
    await automation.processDirectory(txsDir, configPath);
    console.log('Automation completed successfully');
  } catch (error: any) {
    console.error('Automation failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(console.error);
}

export { CSVImportAutomation };