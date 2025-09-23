# CSV Import Automation

This system automatically imports CSV files from your `txs/` directory using your existing import templates.

## Setup

### 1. Configure Accounts

Edit `import-config.json` to map your CSV files to accounts and templates:

```json
{
  "accounts": {
    "TotalChecking": {
      "templateName": "Chase Bank Export",
      "accountId": "your-account-id-here",
      "notes": "Chase checking account CSV format"
    }
  }
}
```

**Important:** Replace `"replace-with-actual-account-id"` with your real account IDs from the database.

### 2. Create Templates

Before running automation, create import templates using the UI at `/import`:

1. Upload a sample CSV file
2. Map the columns correctly
3. Save the template with a descriptive name
4. Use that template name in your `import-config.json`

### 3. Environment Variables

Create a `.env.local` file or set these environment variables:

```bash
AUTOMATION_KEY=your-secure-automation-key-here
```

### 4. Directory Structure

The automation expects this structure:
```
txs/
├── personal/
│   ├── TotalChecking.csv
│   ├── SapphireCC.csv
│   └── AllySavings.csv
├── business/
│   └── Ink_Unlimited.csv
├── processed/     # Created automatically
└── errors/        # Created automatically
```

## Usage

### Manual Run

```bash
# Install dependencies if needed
npm install tsx

# Run automation
tsx scripts/import-automation.ts ./txs ./import-config.json cmfsjjcwi00028oj3053dwaa3
```

### Automated with Cron

Add to your crontab to run daily at 6 AM:

```bash
0 6 * * * cd /path/to/your/app && tsx scripts/import-automation.ts ./txs ./import-config.json cmfsjjcwi00028oj3053dwaa3 >> /var/log/import-automation.log 2>&1
```

## How It Works

1. **Scans** the `txs/` directory for CSV files
2. **Matches** each file to an account configuration based on filename
3. **Loads** the corresponding import template from the database
4. **Parses** the CSV using the template's column mappings
5. **Runs a dry-run** first to check for duplicates
6. **Imports** transactions if everything looks good
7. **Moves** processed files to `processed/` directory
8. **Applies** transfer matching and categorization rules automatically

## File Matching

Files are matched by checking if the filename contains any of the account keys:

- `TotalChecking_2023-09.csv` → matches `"TotalChecking"` account
- `Chase_SapphireCC_export.csv` → matches `"SapphireCC"` account
- `business_Ink_Unlimited.csv` → matches `"Ink_Unlimited"` account

## Safety Features

- **Dry run first**: Always checks what would be imported before doing it
- **Duplicate detection**: Won't import transactions that already exist
- **Backup**: Moves processed files to `processed/` directory
- **Error handling**: Moves problematic files to `errors/` directory
- **Import tags**: All transactions get tagged for easy bulk removal if needed

## Template Examples

Based on your CSV formats, you'll need these templates:

### Chase Bank Template
- Date: `Posting Date` (format: `MM/dd/yyyy`)
- Description: `Description`
- Amount: `Amount`
- Reference: `Check or Slip #`

### Chase Credit Card Template
- Date: `Transaction Date` (format: `MM/dd/yyyy`)
- Description: `Description`
- Amount: `Amount`
- Merchant: `Description` (same field)

### Business Card Template
- Date: `Transaction Date` (format: `MM/dd/yyyy`)
- Description: `Description`
- Amount: `Amount`

## Troubleshooting

### Templates Not Found
- Ensure template names in config exactly match saved template names
- Check that templates exist in the database for your user ID

### Account Not Found
- Verify account IDs are correct in `import-config.json`
- Make sure accounts belong to the specified user

### Authentication Errors
- Check that `AUTOMATION_KEY` environment variable is set
- Ensure the same key is configured in your application

### File Processing Errors
- Check the `errors/` directory for problematic files
- Review logs for specific error messages
- Verify CSV format matches template expectations

## Configuration Reference

### Account Configuration
```json
{
  "templateName": "string",  // Must match saved template name exactly
  "accountId": "string",     // Database account ID
  "notes": "string"          // Description for your reference
}
```

### Settings Configuration
```json
{
  "autoProcessNew": true,        // Process new files automatically
  "backupProcessed": true,       // Move processed files to backup dir
  "processedDir": "./txs/processed",  // Where to store processed files
  "errorDir": "./txs/errors",         // Where to store error files
  "dryRunFirst": true,               // Always dry run first
  "maxDuplicates": 50                // Max duplicates before failing
}
```