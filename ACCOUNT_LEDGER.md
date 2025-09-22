# Account Ledger System

The Account Ledger provides a detailed view of individual investment accounts, showing current holdings, cash positions, cost basis, and unrealized gains/losses.

## Overview

Each investment account now has a dedicated ledger view that calculates and displays:

- **Current Holdings**: Stocks and crypto positions with real-time market values
- **Cash Position**: Available cash balance from deposits/withdrawals/dividends
- **Cost Basis Tracking**: Average cost per share and total investment
- **Unrealized P&L**: Gains and losses on current positions
- **Transaction History**: Detailed record of all account activity

## Features

### 📊 Holdings Analysis
- **Position Tracking**: Automatically calculates quantities from BUY/SELL transactions
- **Average Cost Basis**: Weighted average cost including fees
- **Real-time Pricing**: Current market values using Yahoo Finance and CoinGecko APIs
- **Unrealized P&L**: Gain/loss calculations with percentage returns

### 💰 Cash Management
- **Cash Balance**: Tracks deposits, withdrawals, dividends, and fees
- **Transaction Impact**: Shows how trades affect available cash
- **Currency Support**: Multi-currency account support

### 📈 Performance Metrics
- **Total Portfolio Value**: Combined value of holdings + cash
- **Total Cost Basis**: Amount invested (excluding gains/losses)
- **Overall Return**: Portfolio-wide performance percentage
- **Position-level Returns**: Individual holding performance

### 📝 Transaction History
- **Complete Record**: All transactions affecting the account
- **Transaction Types**: BUY, SELL, DEPOSIT, WITHDRAW, DIVIDEND, INTEREST, FEE, ADJUSTMENT
- **Detailed Information**: Quantities, prices, fees, and notes

## How It Works

### Position Calculation Algorithm

1. **Starting Point**: Account opening balance becomes initial cash
2. **Transaction Processing**: Each transaction affects positions or cash:
   - `BUY`: Reduces cash, increases position, adds to cost basis
   - `SELL`: Increases cash, reduces position, reduces cost basis proportionally
   - `DEPOSIT`: Increases cash balance
   - `WITHDRAW`: Decreases cash balance
   - `DIVIDEND/INTEREST`: Increases cash balance
   - `FEE`: Decreases cash balance

3. **Cost Basis Tracking**:
   - Weighted average cost including all fees
   - Proportional reduction on partial sales
   - FIFO-based for complex scenarios

4. **Market Valuation**:
   - Real-time price fetching for current holdings
   - Market value = quantity × current price
   - Unrealized P&L = market value - cost basis

### Example Calculation

**Traditional IRA Account:**
- Initial Cash: $50,000
- Buy 100 NVDA @ $400 + $10 fees = $40,010 total cost
- Buy 50 GME @ $80 + $5 fees = $4,005 total cost
- Dividend: $500

**Result:**
- Cash: $50,000 - $40,010 - $4,005 + $500 = $6,485
- NVDA: 100 shares, cost basis $40,010 ($400.10 avg)
- GME: 50 shares, cost basis $4,005 ($80.10 avg)
- Total Invested: $44,015

**With Current Prices:**
- NVDA @ $450: Market value $45,000, Unrealized gain $4,990 (+12.5%)
- GME @ $85: Market value $4,250, Unrealized gain $245 (+6.1%)
- **Total Portfolio**: $55,735 ($6,485 cash + $49,250 holdings)

## API Endpoints

### GET `/api/investments/accounts/[id]/ledger`

Returns complete ledger data for an investment account.

**Response Structure:**
```typescript
{
  investmentAccountId: string;
  accountName: string;
  accountType: string;
  assetClass: string;
  kind: string;
  currency: string;
  totalValue: number;
  totalCostBasis: number;
  totalUnrealizedGainLoss: number;
  totalUnrealizedGainLossPercent: number;
  cashPosition: {
    balance: number;
    currency: string;
  };
  holdings: Array<{
    symbol: string;
    assetType: 'CRYPTO' | 'EQUITY';
    quantity: number;
    averageCost: number;
    currentPrice: number;
    marketValue: number;
    costBasis: number;
    unrealizedGainLoss: number;
    unrealizedGainLossPercent: number;
  }>;
  recentTransactions: Array<{
    // Transaction details...
  }>;
}
```

## UI Components

### Account Ledger View (`AccountLedgerView`)

**Features:**
- **Summary Cards**: Total value, cost basis, P&L, return percentage
- **Cash Position**: Current cash balance display
- **Holdings Table**: Detailed position breakdown with real-time prices
- **Transaction History**: Recent account activity
- **Color-coded P&L**: Green for gains, red for losses
- **Asset Type Badges**: Visual distinction between crypto and stocks

**Navigation:**
- Access via "View Ledger" button on each investment account
- Seamless back navigation to main investments page

### Data Formatting

**Holdings Display:**
- Crypto quantities: 6 decimal places (e.g., 0.123456 BTC)
- Stock quantities: Whole numbers (e.g., 100 shares)
- Prices: Appropriate precision per asset type
- Currency formatting: Localized with proper symbols

**Performance Colors:**
- 🟢 Green: Positive gains
- 🔴 Red: Losses
- ⚪ Neutral: Break-even

## Usage Examples

### Viewing Account Holdings

1. Navigate to Investments page
2. Click "View Ledger" on any investment account
3. See complete breakdown:
   - Current holdings with live prices
   - Cash available for investment
   - Total portfolio performance
   - Recent transaction activity

### Understanding Your Returns

**Per-Position Analysis:**
- NVDA: $20,000 invested → $22,500 current = +$2,500 (+12.5%)
- GME: $7,500 invested → $8,500 current = +$1,000 (+13.3%)

**Portfolio-wide:**
- Total Invested: $27,500
- Current Value: $31,000 + $15,000 cash = $46,000
- Overall Return: +$3,500 (+12.7%) on invested capital

### Transaction Impact Tracking

Each transaction shows its effect:
- **Buy Orders**: Reduce cash, increase positions
- **Sell Orders**: Increase cash, reduce positions
- **Dividends**: Increase cash (investment income)
- **Fees**: Reduce cash, increase cost basis

## Testing

### Test Script: `test-ledger.ts`

Run comprehensive ledger testing:
```bash
# Start development server
npm run dev

# Run ledger tests
npx tsx test-ledger.ts
```

**Test Coverage:**
- API endpoint functionality
- Holdings calculation accuracy
- Cash balance tracking
- P&L calculation verification
- Transaction history retrieval

## Benefits

### For Investors
- **Complete Transparency**: See exactly what you own and its performance
- **Tax Planning**: Accurate cost basis for tax reporting
- **Performance Tracking**: Understand which investments are working
- **Cash Management**: Know available funds for new investments

### For Portfolio Management
- **Asset Allocation**: See distribution across holdings
- **Rebalancing**: Identify overweight/underweight positions
- **Historical Analysis**: Track how positions evolved over time
- **Risk Assessment**: Understand concentration risk

## Security & Privacy

- **User-scoped Data**: Each user only sees their own accounts
- **Authentication Required**: All API endpoints require valid session
- **No External Data Exposure**: Holdings data never leaves your system
- **Audit Trail**: All transactions tracked with timestamps

## Future Enhancements

Potential improvements:
- **Realized P&L Tracking**: Track gains/losses from completed sales
- **Tax-loss Harvesting**: Identify opportunities to offset gains
- **Performance Benchmarking**: Compare against market indices
- **Historical Charts**: Visualize portfolio growth over time
- **Export Capabilities**: Download data for external analysis
- **Mobile Optimization**: Enhanced mobile ledger experience