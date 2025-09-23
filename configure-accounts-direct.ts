#!/usr/bin/env tsx
import { readFileSync, writeFileSync } from 'fs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface AccountMapping {
  filename: string;
  accountId: string;
  name: string;
  type: string;
}

interface Config {
  accountMappings: AccountMapping[];
  settings: {
    txsDirectory: string;
    apiBaseUrl: string;
    enableDryRun: boolean;
    logLevel: string;
  };
}

const CONFIG_FILE = './account-config.json';

async function fetchAccounts(): Promise<any[]> {
  try {
    const accounts = await prisma.financialAccount.findMany({
      select: {
        id: true,
        name: true,
        type: true,
      },
    });

    return accounts;
  } catch (error) {
    console.error('❌ Could not fetch accounts from database:', error);
    return [];
  }
}

function loadConfig(): Config {
  try {
    const content = readFileSync(CONFIG_FILE, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    console.error('❌ Could not load config file:', error);
    process.exit(1);
  }
}

function saveConfig(config: Config): void {
  try {
    writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
    console.log('✅ Configuration saved successfully!');
  } catch (error) {
    console.error('❌ Could not save config file:', error);
    process.exit(1);
  }
}

function showCurrentMappings(config: Config): void {
  console.log('\n📋 Current Account Mappings:');
  console.log('=====================================');

  if (config.accountMappings.length === 0) {
    console.log('No mappings configured.');
    return;
  }

  config.accountMappings.forEach((mapping, index) => {
    console.log(`${index + 1}. ${mapping.filename}`);
    console.log(`   Account: ${mapping.name} (${mapping.type})`);
    console.log(`   ID: ${mapping.accountId}`);
    console.log('');
  });
}

async function autoMapAccounts(): Promise<void> {
  const config = loadConfig();

  console.log('🔍 Fetching accounts from database...');
  const accounts = await fetchAccounts();

  if (accounts.length === 0) {
    console.log('❌ No accounts found in database.');
    return;
  }

  console.log(`\n📊 Found ${accounts.length} accounts in your database:`);
  accounts.forEach((account, index) => {
    console.log(`${index + 1}. ${account.name} (${account.type}) - ID: ${account.id}`);
  });

  console.log('\n🤖 Attempting automatic mapping based on account names...');

  let updated = false;

  config.accountMappings.forEach((mapping) => {
    if (mapping.accountId.startsWith('your-')) {
      // Try to find a matching account
      const match = accounts.find(account =>
        account.name.toLowerCase().includes(mapping.name.toLowerCase().split(' ')[0].toLowerCase()) ||
        mapping.name.toLowerCase().includes(account.name.toLowerCase().split(' ')[0].toLowerCase())
      );

      if (match) {
        console.log(`✅ Mapped ${mapping.filename} → ${match.name} (${match.id})`);
        mapping.accountId = match.id;
        mapping.name = match.name;
        mapping.type = match.type;
        updated = true;
      } else {
        console.log(`⚠️  No automatic match found for ${mapping.filename} (${mapping.name})`);
      }
    }
  });

  if (updated) {
    saveConfig(config);
    console.log('\n🎉 Account mappings updated!');
  } else {
    console.log('\n❌ No new mappings could be created automatically.');
    console.log('💡 You may need to manually configure account mappings.');
  }
}

function manualMapping(): void {
  const config = loadConfig();

  console.log('\n🔧 Manual Account Mapping Configuration');
  console.log('=====================================');
  console.log('This feature requires interactive input and is best done directly in the config file.');
  console.log('\nTo manually configure:');
  console.log('1. Open account-config.json');
  console.log('2. Replace "your-*-id" values with actual account IDs from your database');
  console.log('3. Update account names and types as needed');
  console.log('\nExample:');
  console.log('  "accountId": "cm1a2b3c4d5e6f7g8h9i0j"');
  console.log('  "name": "Chase Freedom Credit Card"');
  console.log('  "type": "credit"');

  showCurrentMappings(config);
}

function validateConfig(): void {
  const config = loadConfig();

  console.log('\n🔍 Validating Configuration:');
  console.log('============================');

  let isValid = true;

  // Check for unmapped accounts
  const unmapped = config.accountMappings.filter(m => m.accountId.startsWith('your-'));
  if (unmapped.length > 0) {
    console.log('❌ Unmapped accounts found:');
    unmapped.forEach(m => console.log(`   - ${m.filename} (${m.name})`));
    isValid = false;
  }

  // Check for duplicate account IDs
  const accountIds = config.accountMappings.map(m => m.accountId);
  const duplicates = accountIds.filter((id, index) => accountIds.indexOf(id) !== index);
  if (duplicates.length > 0) {
    console.log('❌ Duplicate account IDs found:');
    duplicates.forEach(id => console.log(`   - ${id}`));
    isValid = false;
  }

  // Check settings
  if (!config.settings.txsDirectory) {
    console.log('❌ Missing txsDirectory setting');
    isValid = false;
  }

  if (isValid) {
    console.log('✅ Configuration is valid!');
    console.log(`📁 Transactions directory: ${config.settings.txsDirectory}`);
    console.log(`📊 Mapped accounts: ${config.accountMappings.length}`);
  } else {
    console.log('\n❌ Configuration has issues that need to be resolved.');
  }
}

async function main() {
  const command = process.argv[2] || 'status';

  try {
    switch (command) {
      case 'auto':
        await autoMapAccounts();
        break;
      case 'manual':
        manualMapping();
        break;
      case 'validate':
        validateConfig();
        break;
      case 'status':
        const config = loadConfig();
        showCurrentMappings(config);
        validateConfig();
        break;
      case 'help':
        console.log('Account Configuration Tool (Direct Database Access)');
        console.log('===================================================');
        console.log('Usage: tsx configure-accounts-direct.ts [command]');
        console.log('');
        console.log('Commands:');
        console.log('  auto     - Automatically map accounts by querying database');
        console.log('  manual   - Show manual configuration instructions');
        console.log('  validate - Validate current configuration');
        console.log('  status   - Show current mappings and validation (default)');
        console.log('  help     - Show this help message');
        console.log('');
        console.log('Environment Variables:');
        console.log('  USER_ID - Your user ID (optional, will use first user if not set)');
        break;
      default:
        console.log(`Unknown command: ${command}`);
        console.log('Use "tsx configure-accounts-direct.ts help" for usage information');
        process.exit(1);
    }
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main().catch(console.error);
}