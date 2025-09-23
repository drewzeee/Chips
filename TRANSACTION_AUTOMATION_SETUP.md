# Transaction Import Automation Setup

This guide will help you set up automated daily transaction imports from CSV files directly to your database.

## 📋 Prerequisites

- Node.js and npm/yarn installed
- TSX installed globally: `npm install -g tsx`
- Prisma database setup and accessible
- CSV transaction files in the `txs/` directory

## 🚀 Quick Start

### 1. Install Dependencies

```bash
# If not already installed
npm install -g tsx
```

### 2. Configure Account Mappings

Run the automatic account mapper (connects directly to your database):

```bash
tsx configure-accounts-direct.ts auto
```

This will:
- Fetch your accounts directly from the database
- Attempt to automatically map CSV files to accounts
- Update the `account-config.json` file

### 3. Verify Configuration

```bash
tsx configure-accounts-direct.ts validate
```

### 4. Test the Import

```bash
tsx import-transactions-direct.ts
```

### 5. Setup Daily Automation

```bash
# Setup to run daily at 9:00 AM
./setup-daily-import.sh setup

# Or specify a custom time (2:30 PM example)
./setup-daily-import.sh setup "30 14"
```

## 📁 File Structure

```
project-root/
├── txs/                          # Transaction CSV files
│   ├── personal/
│   │   ├── AllySavings.csv
│   │   ├── FreedomCC.csv
│   │   └── ...
│   └── business/
│       ├── BusinessSavings.csv
│       └── ...
├── logs/                           # Import logs (auto-created)
├── import-transactions-direct.ts  # Main import script (direct DB access)
├── configure-accounts-direct.ts   # Account configuration helper (direct DB)
├── setup-daily-import.sh          # Automation setup script
└── account-config.json            # Account mappings configuration
```

## ⚙️ Configuration

### Account Mappings

Edit `account-config.json` to customize your account mappings:

```json
{
  "accountMappings": [
    {
      "filename": "AllySavings.csv",
      "accountId": "cm1a2b3c4d5e6f7g8h9i0j",
      "name": "Ally Savings Account",
      "type": "savings"
    }
  ],
  "settings": {
    "txsDirectory": "./txs",
    "apiBaseUrl": "http://localhost:3000",
    "enableDryRun": true,
    "logLevel": "info"
  }
}
```

### CSV File Format

Your CSV files should have these columns (headers can vary):
- `Date` or `date` - Transaction date
- `Amount` or `amount` - Transaction amount (positive for credits, negative for debits)
- `Description` or `description` - Transaction description
- `Merchant` or `merchant` (optional) - Merchant name
- `Reference` or `reference` (optional) - Reference number

Example CSV:
```csv
Date,Time,Amount,Type,Description
2025-09-16,04:42:58,8512.30,Deposit,COINBASE INC. 408DF021
2025-09-15,23:42:50,14.48,Deposit,Interest Paid
```

## 🔧 Available Commands

### Configuration Commands

```bash
# Automatically map accounts from database
tsx configure-accounts-direct.ts auto

# Show manual configuration instructions
tsx configure-accounts-direct.ts manual

# Validate current configuration
tsx configure-accounts-direct.ts validate

# Show current status and mappings
tsx configure-accounts-direct.ts status

# Show help
tsx configure-accounts-direct.ts help
```

### Automation Commands

```bash
# Setup daily import (default: 9 AM)
./setup-daily-import.sh setup

# Setup with custom time (format: "minute hour")
./setup-daily-import.sh setup "0 8"    # 8:00 AM
./setup-daily-import.sh setup "30 14"  # 2:30 PM
./setup-daily-import.sh setup "0 22"   # 10:00 PM

# Test import manually
./setup-daily-import.sh test

# Check automation status
./setup-daily-import.sh status

# Remove automation
./setup-daily-import.sh remove

# Show help
./setup-daily-import.sh help
```

### Manual Import

```bash
# Run import manually
tsx import-transactions-direct.ts
```

## 🔍 How It Works

1. **File Detection**: Scans the `txs/` directory for CSV files modified today
2. **Account Mapping**: Maps CSV filenames to database account IDs using `account-config.json`
3. **Duplicate Check**: Queries database directly to identify new vs existing transactions
4. **Import**: Imports only new transactions directly to database via Prisma
5. **Transfer Detection**: Can be extended for automatic transfer detection
6. **Categorization**: Can be extended for automatic categorization rules

## 📊 Monitoring

### Check Automation Status

```bash
./setup-daily-import.sh status
```

### View Logs

```bash
# View today's import log
tail -f logs/import-$(date +%Y%m).log

# View all recent logs
ls -la logs/
```

### Cron Job Management

```bash
# View all cron jobs
crontab -l

# View only transaction import jobs
crontab -l | grep import-transactions-direct
```

## 🚨 Troubleshooting

### Common Issues

**❌ "No account mapping found for filename"**
- Run `tsx configure-accounts-direct.ts auto` to set up mappings
- Or manually edit `account-config.json`

**❌ "Could not fetch accounts from database"**
- Ensure your database is running and accessible
- Check your Prisma connection settings
- Verify database schema is up to date

**❌ "Import failed: Invalid account"**
- Verify account IDs in `account-config.json` match your database
- Run `tsx configure-accounts-direct.ts validate`

**❌ "No transaction files modified today"**
- Ensure your transaction pulling script updates file modification times
- Check that CSV files are in the correct `txs/` directory structure

### Debug Mode

Run with verbose logging:

```bash
# Test with detailed output
tsx import-transactions-direct.ts

# Check configuration
tsx configure-accounts-direct.ts validate

# Check database connection
tsx configure-accounts-direct.ts status
```

### Reset Configuration

```bash
# Remove automation
./setup-daily-import.sh remove

# Reconfigure accounts
tsx configure-accounts-direct.ts auto

# Setup automation again
./setup-daily-import.sh setup
```

## 🔐 Security Notes

- Direct database access - ensure your database is properly secured
- Monitor import logs for suspicious activity
- Ensure CSV files don't contain sensitive data beyond transactions
- Keep your `account-config.json` file secure as it contains account mappings

## 📞 Support

If you encounter issues:

1. Check the troubleshooting section above
2. Verify your configuration with `tsx configure-accounts-direct.ts validate`
3. Review import logs in the `logs/` directory
4. Test manually with `tsx import-transactions-direct.ts`

## 🎯 Advanced Configuration

### Custom CSV Parsers

Modify `import-transactions-direct.ts` if your CSV format differs:

```typescript
// Custom parsing logic
return result.data.map((row: any) => ({
  date: row['Transaction Date'],     // Custom column name
  amount: parseFloat(row['Debit']) * -1 || parseFloat(row['Credit']), // Handle debit/credit columns
  description: row['Transaction Description'],
  merchant: row['Merchant Name'],
  reference: row['Check Number'],
}));
```

### Custom Scheduling

For non-daily schedules, edit the cron job manually:

```bash
crontab -e
```

Example schedules:
```bash
# Every weekday at 9 AM
0 9 * * 1-5 cd /path/to/project && tsx import-transactions-direct.ts

# Twice daily
0 9,18 * * * cd /path/to/project && tsx import-transactions-direct.ts

# Weekly on Mondays
0 9 * * 1 cd /path/to/project && tsx import-transactions-direct.ts
```

---

✅ **Setup Complete!** Your transaction automation should now be running daily.