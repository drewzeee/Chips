# Investment Valuation Automation Setup

## Overview

Your investment valuation system now supports automated updates using multiple approaches:

### 🔧 What's Available

1. **Manual Trigger UI** - Button in the Investments page
2. **API Endpoints** - For programmatic access
3. **Scheduled Jobs** - External cron integration
4. **npm Scripts** - Command-line tools

---

## 🚀 Quick Start

### 1. Manual Updates (Recommended for Testing)

**Via UI:**
- Go to `/investments` page
- Click "Update Now" in the "Market Valuations" card
- Watch real-time updates and results

**Via Command Line:**
```bash
npm run valuations:update
```

### 2. API Endpoints

**Update Valuations (Authenticated):**
```bash
POST /api/investments/valuations/update
```

**Cron Endpoint (For External Services):**
```bash
POST /api/cron/valuations
Authorization: Bearer YOUR_CRON_SECRET_TOKEN
```

**Status Check:**
```bash
GET /api/investments/valuations/update
```

---

## ⏰ Setting Up Automated Scheduling

### Option 1: External Cron Services (Recommended)

**1. cron-job.org (Free)**
- Create account at https://cron-job.org
- Add new cron job:
  - URL: `https://your-domain.com/api/cron/valuations`
  - Method: POST
  - Schedule: `0 */6 * * *` (every 6 hours)
  - Add header: `Authorization: Bearer YOUR_SECRET_TOKEN`

**2. GitHub Actions (Free for public repos)**
```yaml
# .github/workflows/valuations.yml
name: Update Investment Valuations
on:
  schedule:
    - cron: '0 */6 * * *'  # Every 6 hours
jobs:
  update:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger valuation update
        run: |
          curl -X POST \\
            -H "Authorization: Bearer ${{ secrets.CRON_SECRET_TOKEN }}" \\
            https://your-domain.com/api/cron/valuations
```

**3. Vercel Cron (Paid plans)**
```js
// vercel.json
{
  "crons": [{
    "path": "/api/cron/valuations",
    "schedule": "0 */6 * * *"
  }]
}
```

### Option 2: Server Cron (Self-hosted)

```bash
# Add to your server's crontab
# Run every 6 hours
0 */6 * * * curl -X POST -H "Authorization: Bearer YOUR_SECRET_TOKEN" https://your-domain.com/api/cron/valuations
```

### Option 3: Direct Node Script (No API Calls)

- Add the new runner script to any scheduler that can invoke Node/tsx directly.
- Useful when the app server is behind a firewall or you prefer to keep traffic off HTTP.

```bash
# Local cron example: run every night at 11:30pm
30 23 * * * cd /path/to/project && npx tsx scripts/run-investment-valuations.ts >> logs/valuations.log 2>&1

# Limit to a single user
npx tsx scripts/run-investment-valuations.ts --user=USER_ID

# Preview without writing to the database
npx tsx scripts/run-investment-valuations.ts --dry-run
```

`package.json` now exposes a shortcut as well:

```bash
npm run valuations:run
```

The script shares the same calculation and adjustment logic as the API endpoint but executes it entirely inside the process, so no extra HTTP calls or `CRON_SECRET_TOKEN` headers are required.

---

## 🔐 Security Setup

### 1. Set Environment Variables

```bash
# .env.local
CRON_SECRET_TOKEN="your-secure-random-token-here"
```

### 2. Generate Secure Token

```bash
# Generate a secure token
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## 🎯 How It Works

### Valuation Process

1. **Fetch Crypto Prices** - Gets current prices from CoinGecko API
2. **Calculate Positions** - Analyzes your BUY/SELL transactions
3. **Update Valuations** - Creates InvestmentValuation records
4. **Adjust Balances** - Adds valuation adjustment transactions
5. **Maintain Audit Trail** - All changes are logged and reversible

### What Gets Updated

- ✅ Bitcoin (BTC) positions
- ✅ Other supported cryptocurrencies (ETH, USDC, etc.)
- ✅ Investment account balances
- ✅ Net worth calculations
- ❌ **NOT** included in income/expense reports

### Example Output

```json
{
  "success": true,
  "processed": 1,
  "updated": 1,
  "results": [{
    "accountName": "Growth Fund",
    "assetSymbol": "BTC",
    "quantity": 0.5,
    "oldValue": 20000.00,
    "newValue": 57876.50,
    "change": 37876.50,
    "changePercent": 189.4,
    "pricePerUnit": 115753.00
  }]
}
```

---

## 📊 Monitoring & Logs

### Check Last Update
- View timestamp in the UI after manual updates
- Check `/api/investments/valuations/update` for status

### View Results
- All valuation adjustments appear as transactions
- Reference format: `investment_valuation_{id}`
- Account balances update immediately

### Error Handling
- Failed price fetches are logged and reported
- Individual account failures don't stop other updates
- All errors returned in API response

---

## 🔧 Customization

### Update Frequency Recommendations

- **High Trading Volume:** Every 1 hour
- **Normal Investing:** Every 6 hours
- **Long-term Holdings:** Daily
- **Conservative:** Weekly

### Adding New Assets

The system automatically supports any cryptocurrency available in the CoinGecko API. Just record transactions with the correct symbol (BTC, ETH, etc.).

### Rate Limiting

- CoinGecko free tier: 10-50 calls/minute
- Built-in 5-minute cache reduces API calls
- Batch fetching for multiple symbols

---

## 🐛 Troubleshooting

### Common Issues

**"No price found for {symbol}"**
- Check symbol spelling in your transactions
- Verify symbol exists in CoinGecko
- Add to CURRENCY_ID_MAP if needed

**"Failed to fetch crypto prices"**
- Check internet connection
- Verify CoinGecko API status
- Rate limiting - wait a few minutes

**"Unauthorized" for cron endpoint**
- Check CRON_SECRET_TOKEN environment variable
- Verify Authorization header format
- Use correct Bearer token

### Debug Commands

```bash
# Test price fetching
npm run dev  # Start server
curl http://localhost:3000/api/investments/valuations/update

# Check specific crypto prices
npx tsx price-check.ts

# Run standalone valuation (legacy)
npx tsx run-bitcoin-valuation.ts
```

---

## 🚀 Production Deployment

1. **Deploy your app** with the new automation endpoints
2. **Set CRON_SECRET_TOKEN** in production environment
3. **Choose scheduling method** (external cron recommended)
4. **Test the automation** with a manual trigger first
5. **Monitor the first few runs** to ensure proper operation

Your investment valuations will now stay current with market prices automatically! 🎉
