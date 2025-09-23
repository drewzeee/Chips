#!/usr/bin/env tsx

import fs from 'fs/promises';
import { prisma } from '@/lib/prisma';

async function testSetup() {
  console.log('🔍 Testing import automation setup...\n');

  // Test 1: Check config file
  console.log('1. Checking import-config.json...');
  try {
    const configData = await fs.readFile('./import-config.json', 'utf-8');
    const config = JSON.parse(configData);
    console.log('   ✓ Config file exists and is valid JSON');

    const accountKeys = Object.keys(config.accounts);
    console.log(`   ✓ Found ${accountKeys.length} account configurations`);

    for (const [key, account] of Object.entries(config.accounts)) {
      const typedAccount = account as any;
      if (!typedAccount.accountId || typedAccount.accountId === 'replace-with-actual-account-id') {
        console.log(`   ⚠️  Account "${key}" needs a real account ID`);
      } else {
        console.log(`   ✓ Account "${key}" configured with ID: ${typedAccount.accountId}`);
      }
    }
  } catch (error) {
    console.log('   ❌ Error reading config file:', error);
    return;
  }

  // Test 2: Check txs directory
  console.log('\n2. Checking txs directory...');
  try {
    const txsDir = './txs';
    const entries = await fs.readdir(txsDir, { withFileTypes: true });

    let csvCount = 0;
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const subEntries = await fs.readdir(`${txsDir}/${entry.name}`);
        const csvFiles = subEntries.filter(file => file.endsWith('.csv'));
        csvCount += csvFiles.length;
        if (csvFiles.length > 0) {
          console.log(`   ✓ Found ${csvFiles.length} CSV files in ${entry.name}/`);
        }
      } else if (entry.name.endsWith('.csv')) {
        csvCount++;
        console.log(`   ✓ Found CSV file: ${entry.name}`);
      }
    }

    if (csvCount === 0) {
      console.log('   ⚠️  No CSV files found in txs directory');
    } else {
      console.log(`   ✓ Total: ${csvCount} CSV files found`);
    }
  } catch (error) {
    console.log('   ❌ Error reading txs directory:', error);
  }

  // Test 3: Check environment variables
  console.log('\n3. Checking environment variables...');
  const automationKey = process.env.AUTOMATION_KEY;
  if (!automationKey || automationKey === 'change-me-in-production') {
    console.log('   ⚠️  AUTOMATION_KEY environment variable not set or using default');
    console.log('      Set this to a secure random string for production');
  } else {
    console.log('   ✓ AUTOMATION_KEY is configured');
  }

  // Test 4: Check database connection and templates
  console.log('\n4. Checking database connection and templates...');
  try {
    const templateCount = await prisma.importTemplate.count();
    console.log(`   ✓ Database connected, found ${templateCount} import templates`);

    if (templateCount === 0) {
      console.log('   ⚠️  No import templates found - create some via the /import UI first');
    } else {
      const templates = await prisma.importTemplate.findMany({
        select: { name: true, userId: true }
      });

      console.log('   📋 Available templates:');
      for (const template of templates) {
        console.log(`      - "${template.name}" (user: ${template.userId})`);
      }
    }

    const accountCount = await prisma.financialAccount.count();
    console.log(`   ✓ Found ${accountCount} financial accounts in database`);

  } catch (error) {
    console.log('   ❌ Database connection error:', error);
  }

  console.log('\n🎉 Setup check complete!');
  console.log('\nNext steps:');
  console.log('1. Create import templates via the /import UI if you haven\'t already');
  console.log('2. Update import-config.json with correct account IDs and template names');
  console.log('3. Set AUTOMATION_KEY environment variable');
  console.log('4. Run: npm run import:auto YOUR_USER_ID');
}

testSetup().catch(console.error);