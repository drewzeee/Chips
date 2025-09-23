# Transaction Import Automation Setup

This guide will help you set up automated daily transaction imports from CSV files to your application.

## 📋 Prerequisites

- Node.js and npm/yarn installed
- TSX installed globally: `npm install -g tsx`
- Access to your application's database
- CSV transaction files in the `txs/` directory
- API running locally or accessible endpoint

## 🚀 Quick Start

### 1. Install Dependencies

```bash
# If not already installed
npm install -g tsx
```

### 2. Authentication Setup

You have two options for authentication:

#### Option A: Interactive Login (Recommended)
```bash
tsx auth-helper.ts login
```

This will prompt for your email and password, then save a session that lasts 24 hours.

#### Option B: Environment Variables
```bash
# Set your login credentials
export LOGIN_EMAIL="your@email.com"
export LOGIN_PASSWORD="yourpassword"

# Optional - defaults to http://localhost:3000
export API_BASE_URL="http://localhost:3000"
```

### 3. Configure Account Mappings

Run the automatic account mapper:

```bash
tsx configure-accounts.ts auto
```

This will:
- Fetch your accounts from the API
- Attempt to automatically map CSV files to accounts
- Update the `account-config.json` file

### 4. Verify Configuration

```bash
tsx configure-accounts.ts validate
```

### 5. Test Authentication

```bash
tsx auth-helper.ts test
```

### 6. Test the Import

```bash
./setup-daily-import.sh test
```

### 7. Setup Daily Automation

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
├── logs/                         # Import logs (auto-created)
├── import-transactions.ts        # Main import script
├── configure-accounts.ts         # Account configuration helper
├── setup-daily-import.sh        # Automation setup script
├── auth-helper.ts               # Authentication helper
├── account-config.json          # Account mappings configuration
└── .session-cache               # Cached authentication session
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

### Authentication Commands

```bash
# Interactive login (saves session for 24 hours)
tsx auth-helper.ts login

# Test current authentication
tsx auth-helper.ts test

# Show authentication status
tsx auth-helper.ts status

# Clear cached session
tsx auth-helper.ts clear

# Show help
tsx auth-helper.ts help
```

### Configuration Commands

```bash
# Automatically map accounts from API
tsx configure-accounts.ts auto

# Show manual configuration instructions
tsx configure-accounts.ts manual

# Validate current configuration
tsx configure-accounts.ts validate

# Show current status and mappings
tsx configure-accounts.ts status

# Show help
tsx configure-accounts.ts help
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
tsx import-transactions.ts
```

## 🔍 How It Works

1. **File Detection**: Scans the `txs/` directory for CSV files modified today
2. **Account Mapping**: Maps CSV filenames to database account IDs using `account-config.json`
3. **Duplicate Check**: Performs a dry run to identify new vs existing transactions
4. **Import**: Imports only new transactions via the `/api/import` endpoint
5. **Transfer Detection**: Automatically detects and marks transfers between accounts
6. **Categorization**: Applies any configured categorization rules

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
crontab -l | grep import-transactions
```

## 🚨 Troubleshooting

### Common Issues

**❌ "No account mapping found for filename"**
- Run `tsx configure-accounts.ts auto` to set up mappings
- Or manually edit `account-config.json`

**❌ "Import failed: 401 Unauthorized"**
- Run `tsx auth-helper.ts login` to authenticate
- Check that your credentials are correct
- Ensure your session hasn't expired (lasts 24 hours)

**❌ "Import failed: 400 Invalid account"**
- Verify account IDs in `account-config.json` match your database
- Run `tsx configure-accounts.ts validate`

**❌ "No transaction files modified today"**
- Ensure your transaction pulling script updates file modification times
- Check that CSV files are in the correct `txs/` directory structure

### Debug Mode

Run with verbose logging:

```bash
# Test authentication
tsx auth-helper.ts test

# Test with detailed output
tsx import-transactions.ts

# Check configuration
tsx configure-accounts.ts validate
```

### Reset Configuration

```bash
# Remove automation
./setup-daily-import.sh remove

# Clear authentication
tsx auth-helper.ts clear

# Re-authenticate
tsx auth-helper.ts login

# Reconfigure accounts
tsx configure-accounts.ts auto

# Setup automation again
./setup-daily-import.sh setup
```

## 🔐 Security Notes

- Sessions are cached for 24 hours in `.session-cache` file
- Store login credentials securely (use `.env` file, not in code)
- Session cache file contains authentication cookies - keep secure
- Monitor import logs for suspicious activity
- Ensure CSV files don't contain sensitive data beyond transactions

## 📞 Support

If you encounter issues:

1. Check the troubleshooting section above
2. Verify your configuration with `tsx configure-accounts.ts validate`
3. Review import logs in the `logs/` directory
4. Test manually with `./setup-daily-import.sh test`

## 🎯 Advanced Configuration

### Custom CSV Parsers

Modify `import-transactions.ts` if your CSV format differs:

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
0 9 * * 1-5 cd /path/to/project && tsx import-transactions.ts

# Twice daily
0 9,18 * * * cd /path/to/project && tsx import-transactions.ts

# Weekly on Mondays
0 9 * * 1 cd /path/to/project && tsx import-transactions.ts
```

---

✅ **Setup Complete!** Your transaction automation should now be running daily.