# 💰 Chips Financial Hub

A comprehensive self-hosted personal finance platform that centralizes budgeting, transaction management, investment tracking, and financial automation. Built with modern web technologies and designed for power users who want complete control over their financial data.

## 🚀 Key Features

### 🔐 **Secure Authentication & User Management**
- Email/password authentication with NextAuth.js
- Secure session management with JWT tokens
- Individual user accounts with data isolation
- Password hashing with bcrypt

### 🏦 **Comprehensive Account Management**
- **Multiple Account Types**: Checking, Savings, Credit Cards, Cash, Investment accounts
- **Multi-currency Support**: Handle different currencies per account
- **Account Features**: Opening balances, credit limits, institution tracking, custom notes
- **Real-time Balance Calculations**: Automatic balance updates based on transactions

### 💳 **Advanced Transaction Management**
- **Full Transaction Lifecycle**: Create, edit, delete, search, and filter transactions
- **Transaction Types**: Income, expenses, transfers, investment trades, adjustments
- **Smart Features**: Merchant tracking, reference numbers, status management, memo fields
- **Transfer Detection**: Automatic detection and pairing of account-to-account transfers
- **Precision Handling**: Cent-based storage for accurate financial calculations

### 🏷️ **Intelligent Categorization System**
- **Hierarchical Categories**: Parent/child category relationships
- **Visual Customization**: Category colors, icons, and visual indicators
- **Budget Integration**: Set monthly budget limits per category
- **Transaction Splits**: Split single transactions across multiple categories
- **Smart Rules**: Automated categorization based on patterns and rules

### 📊 **Professional Investment Tracking**
- **Investment Account Types**: Brokerage accounts, crypto wallets, 401k accounts
- **Asset Management**: Individual asset tracking with symbols and quantities
- **Trade Recording**: Buy/sell trades, deposits, withdrawals, dividends, fees
- **Real-time Valuations**: Automated market price updates via CoinGecko API
- **Performance Analytics**: Unrealized gains/losses, historical performance tracking
- **✨ Automated Valuation System**:
  - Real-time crypto price fetching
  - Scheduled valuation updates
  - Manual trigger capabilities
  - Investment/cash flow separation

### 📈 **Rich Dashboard & Analytics**
- **Real-time Overview**: Net worth, monthly summaries, cash flow analysis
- **Interactive Charts**: Net worth trends, spending breakdowns, budget progress
- **Key Metrics**: Average cash flow, credit utilization, investment returns
- **Customizable Timeframes**: 6 months, 1 year, 2 years, or all-time views

### 📊 **Comprehensive Reporting**
- **Monthly Reports**: Income vs expense analysis, category breakdowns, spending trends
- **Merchant Analytics**: Top spending merchants and patterns
- **Budget Tracking**: Budget vs actual spending with variance analysis
- **Export Capabilities**: CSV exports with flexible date ranges and filtering

### 🔄 **Powerful Data Import & Integration**
- **Flexible CSV Import**: Custom column mapping with reusable templates
- **Bulk Processing**: Import thousands of transactions efficiently
- **Duplicate Detection**: Smart duplicate prevention during imports
- **Bank Integration Ready**: Template system for different financial institutions
- **Real-time Market Data**: CoinGecko API integration for crypto prices

### 🤖 **Advanced Automation**
- **Smart Transaction Rules**: Auto-categorization based on description, amount, account
- **Rule Engine**: Priority-based rule system with preview capabilities
- **Investment Automation**: Scheduled valuation updates with external cron support
- **API Endpoints**: RESTful APIs for automation and integration
- **Manual Triggers**: UI buttons for immediate updates and processing

### ⚙️ **Professional Configuration**
- **Rule Management**: Create, test, and apply categorization rules
- **Template System**: Reusable import configurations
- **Theme Support**: Light/dark mode with system preference detection
- **Multi-currency**: Support for different currencies across accounts

## 🛠️ Tech Stack

- **Frontend**: Next.js 15 with App Router, TypeScript, TailwindCSS 4
- **Backend**: Next.js API routes with comprehensive validation
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: NextAuth.js with credential provider
- **Visualization**: Recharts for interactive charts and graphs
- **Data Processing**: Papa Parse for CSV import capabilities
- **Real-time Data**: CoinGecko API for market prices
- **Automation**: Built-in cron endpoints and scheduling support

## ⚡ Quick Start

### Prerequisites
- Node.js 20+
- PostgreSQL database (Supabase recommended)
- npm or yarn package manager

### Installation

```bash
# Clone and install
git clone <repository-url>
cd chips
npm install

# Environment setup
cp .env.example .env
# Configure your database URLs and NextAuth secret

# Database setup
npm run db:init
npx prisma generate

# Start development server
npm run dev
```

Visit `http://localhost:3000` to create your account and start managing your finances!

## 📁 Project Structure

```
src/
├── app/
│   ├── (auth)/              # Authentication pages
│   ├── (protected)/         # Main application pages
│   │   ├── dashboard/       # Dashboard and analytics
│   │   ├── accounts/        # Account management
│   │   ├── investments/     # Investment tracking
│   │   ├── transactions/    # Transaction management
│   │   ├── categories/      # Category management
│   │   ├── import/         # CSV import wizard
│   │   ├── reports/        # Financial reports
│   │   └── settings/       # Configuration
│   └── api/                # REST API endpoints
├── components/             # Reusable UI components
├── lib/                   # Utilities and configurations
└── types/                 # TypeScript type definitions

prisma/
├── schema.prisma          # Database schema
└── migrations/           # Database migrations
```

## 🔧 Automation Setup

### Investment Valuation Automation

Set up automated investment valuations to keep your portfolio current:

**Option 1: External Cron Service**
```bash
# Using cron-job.org or similar
POST https://your-domain.com/api/cron/valuations
Authorization: Bearer YOUR_SECRET_TOKEN
Schedule: 0 */6 * * * (every 6 hours)
```

**Option 2: GitHub Actions**
```yaml
# .github/workflows/valuations.yml
name: Update Investment Valuations
on:
  schedule:
    - cron: '0 */6 * * *'
jobs:
  update:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger valuation update
        run: |
          curl -X POST \
            -H "Authorization: Bearer ${{ secrets.CRON_SECRET_TOKEN }}" \
            https://your-domain.com/api/cron/valuations
```

**Option 3: Manual Triggers**
- Use the "Update Now" button in the Investments page
- Run `npm run valuations:update` from command line
- Call the API endpoint directly

## 🔐 Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `DATABASE_URL` | PostgreSQL connection string | ✅ |
| `DIRECT_DATABASE_URL` | Direct database connection for migrations | ✅ |
| `NEXTAUTH_SECRET` | Secret for JWT signing | ✅ |
| `NEXTAUTH_URL` | Base URL for authentication callbacks | ✅ |
| `CRON_SECRET_TOKEN` | Secret token for automation endpoints | 🔄 |

## 📋 Available Scripts

```bash
npm run dev              # Start development server
npm run build           # Build for production
npm run start           # Start production server
npm run lint            # Run ESLint
npm run db:init         # Run database migrations
npm run valuations:update    # Update investment valuations
npm run valuations:cron     # Test cron endpoint
```

## 📊 Historical Data Management

### Import Historical Valuations

Import historical investment account valuations from CSV files:

```bash
# Import from CSV file
npx tsx scripts/import-historical-valuations.ts --csv /path/to/your/file.csv

# Import with overwrite (replace existing valuations)
npx tsx scripts/import-historical-valuations.ts --csv /path/to/your/file.csv --overwrite

# Import example data for testing
npx tsx scripts/import-historical-valuations.ts --example
```

**CSV Format:**
```csv
date,accountName,value
5/1/2022,Growth Fund,"70,605.52"
5/2/2022,Growth Fund,"73,474.51"
5/3/2022,Growth Fund,"72,477.44"
```

**Features:**
- Supports quoted values with commas (e.g., `"70,605.52"`)
- Handles M/D/YYYY date format automatically
- Creates automatic valuation adjustment transactions
- Duplicate detection with optional overwrite
- Progress tracking and error reporting

### Export Historical Valuations

Export valuation data from the database to CSV or JSON:

```bash
# Export all valuations to CSV
npx tsx scripts/export-historical-valuations.ts

# Export specific account data
npx tsx scripts/export-historical-valuations.ts --account "Growth Fund"

# Export date range
npx tsx scripts/export-historical-valuations.ts --start-date 1/1/2024 --end-date 12/31/2024

# Export to custom file
npx tsx scripts/export-historical-valuations.ts --output my_data.csv

# Export as JSON
npx tsx scripts/export-historical-valuations.ts --format json

# Combine filters
npx tsx scripts/export-historical-valuations.ts --account "Growth Fund" --start-date 1/1/2024 --format json
```

**Export Options:**
- **Account filtering**: Filter by account name (partial match)
- **Date filtering**: Start and/or end date ranges
- **Output formats**: CSV or JSON
- **Custom filenames**: Specify output file or auto-generate timestamped files
- **Summary statistics**: Shows date ranges, record counts, and value ranges per account

**Example Export Summary:**
```
📈 Export Summary by Account:
Growth Fund:
  📅 Date range: May 1, 2022 - Sep 22, 2025
  📊 Records: 1,210
  💰 Value range: $70,605 - $200,092
```

## 🎯 Key Strengths

- **🔒 Security First**: Secure authentication, input validation, SQL injection protection
- **📊 Investment-Aware**: Proper separation of investments from cash flow calculations
- **🤖 Automation-Ready**: Built-in scheduling and API endpoints for automation
- **📥 Import-Friendly**: Flexible CSV import with bank-specific templates
- **⚡ Real-time Updates**: Live market data integration with CoinGecko
- **🌍 Multi-currency**: Handle international accounts and currencies
- **🏗️ Professional Architecture**: Scalable, maintainable, and well-documented codebase

## 🆕 Recent Enhancements

- ✅ **Automated Investment Valuations** with real-time crypto price updates
- ✅ **Investment/Cash Flow Separation** for accurate financial reporting
- ✅ **Manual Valuation Triggers** via UI and API endpoints
- ✅ **External Automation Support** with cron job integration
- ✅ **Enhanced Error Handling** with comprehensive validation and reporting
- ✅ **Dark Mode Support** with system preference detection
- ✅ **Performance Optimizations** for large transaction datasets

## 🚀 Deployment

The application is production-ready and can be deployed to:
- **Vercel** (recommended for Next.js apps)
- **Docker containers**
- **Traditional VPS/cloud servers**
- **Self-hosted environments**

For production deployment:
1. Set up PostgreSQL database
2. Configure environment variables
3. Run database migrations
4. Build and deploy the application
5. Set up automation endpoints if desired

## 📚 Documentation

- **Setup Guide**: See `AUTOMATION_SETUP.md` for detailed automation configuration
- **API Documentation**: REST endpoints documented in code with TypeScript types
- **Database Schema**: Comprehensive Prisma schema with relationships and constraints

## 🤝 Contributing

This is a personal finance platform designed for self-hosting. Feel free to fork and customize for your own needs!

## 📄 License

[Your chosen license]

---

**Chips Financial Hub** - Take control of your financial data with professional-grade tools and automation capabilities. 💰✨