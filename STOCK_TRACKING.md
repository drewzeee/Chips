# Stock Price Tracking Integration

This document explains the newly added stock price tracking functionality that works alongside the existing crypto price tracking.

## Overview

The investment tracking system now supports both cryptocurrency and equity (stock) investments with automated price fetching and valuation updates.

## Features Added

### 1. Yahoo Finance Integration (`src/lib/stock-prices.ts`)

- **Real-time stock price fetching** using Yahoo Finance API
- **Symbol validation** for stock tickers
- **Price caching** (5-minute cache to avoid rate limiting)
- **Market status detection** (open/closed/unknown)
- **Error handling** for invalid symbols or API failures

### 2. Unified Asset Price System (`src/lib/asset-prices.ts`)

- **Mixed portfolio support** - crypto and stocks in one system
- **Parallel price fetching** for optimal performance
- **Portfolio value calculations** with breakdowns by asset type
- **Flexible price formatting** (crypto vs stock conventions)
- **Asset display name resolution**

### 3. Enhanced Valuation Automation

- **Updated API endpoints** to handle both crypto and equity assets
- **Asset type detection** from transaction records
- **Separate price fetching** for crypto (CoinGecko) and stocks (Yahoo Finance)
- **Combined valuation updates** for investment accounts

### 4. Improved UI Experience

- **Asset type badges** (Crypto/Stock) with color coding
- **Smart symbol suggestions** based on asset type selection
- **Enhanced asset displays** showing ticker symbols and display names
- **Price formatting** appropriate for each asset type

## How It Works

### Price Fetching Flow

1. **Position Calculation**: System analyzes BUY/SELL transactions to determine current holdings
2. **Asset Separation**: Positions are split into crypto and equity groups based on `assetType`
3. **Parallel Fetching**:
   - Crypto prices from CoinGecko API
   - Stock prices from Yahoo Finance API
4. **Value Calculation**: Each position is priced using the appropriate price feed
5. **Portfolio Aggregation**: Total values calculated with crypto/stock breakdowns

### Database Integration

The existing schema supports mixed assets:
- `InvestmentAssetType` enum: `CRYPTO | EQUITY`
- `InvestmentTransaction.assetType` field distinguishes asset types
- `InvestmentAsset.type` field categorizes individual assets

### API Endpoints

#### Manual Valuation Update
```
POST /api/investments/valuations/update
```
- Supports both authenticated and internal (cron) requests
- Processes all investment accounts for a user
- Fetches prices for all asset types
- Updates account valuations

#### Scheduled Automation
```
POST /api/cron/valuations
```
- External cron job endpoint
- Processes all users with investment accounts
- Handles both crypto and stock price updates

## Usage Examples

### Adding Stock Investments

1. **Create Investment Account**:
   - Set Asset Class to "EQUITY" or "MIXED"
   - Choose "BROKERAGE" as account type

2. **Record Stock Purchase**:
   - Type: "BUY"
   - Asset Type: "EQUITY"
   - Symbol: Stock ticker (e.g., "AAPL", "TSLA")
   - Quantity: Number of shares
   - Amount: Total purchase amount

3. **Automated Valuation**:
   - System fetches current stock price from Yahoo Finance
   - Calculates position value (shares × current price)
   - Updates account valuation automatically

### Mixed Portfolios

Accounts can hold both crypto and stocks:
- BTC: 0.5 coins @ $115,386 = $57,693
- AAPL: 10 shares @ $245.50 = $2,455
- **Total Portfolio Value**: $60,148

## Supported Stock Symbols

The system supports most major stock tickers:
- **US Markets**: AAPL, MSFT, GOOGL, TSLA, NVDA, etc.
- **Symbol Validation**: 1-5 characters, letters only
- **Exchange Suffixes**: Supports formats like "TSM.TO" for international exchanges

## Testing

### Test Scripts Available

1. **Stock Price Testing**: `test-stock-prices.ts`
   - Tests Yahoo Finance API integration
   - Validates symbol formats
   - Tests portfolio calculations

2. **Mixed Valuation Testing**: `test-mixed-valuation.ts`
   - Tests end-to-end valuation automation
   - Requires development server running

### Running Tests

```bash
# Test stock price fetching
npx tsx test-stock-prices.ts

# Test full valuation system (requires dev server)
npm run dev
npx tsx test-mixed-valuation.ts
```

## Configuration

### Environment Variables

No additional environment variables required. The system uses:
- **CoinGecko API**: Public API for crypto prices
- **Yahoo Finance API**: Public API for stock prices

### Rate Limiting

- **5-minute cache** for both crypto and stock prices
- **Parallel requests** for different asset types
- **Individual error handling** per symbol

## Error Handling

The system gracefully handles:
- **Invalid stock symbols**: Logs warnings, continues with valid symbols
- **API failures**: Returns partial results if some prices fail
- **Network issues**: Cached prices used when available
- **Missing data**: Clear error messages in valuation results

## Future Enhancements

Potential improvements:
- **International exchanges** (LSE, TSE, etc.)
- **Options and derivatives** tracking
- **Dividend tracking** automation
- **Real-time price updates** via WebSocket
- **Price alerts** and notifications

## Troubleshooting

### Common Issues

1. **No stock prices fetched**:
   - Check symbol format (1-5 letters)
   - Verify ticker exists on Yahoo Finance
   - Check network connectivity

2. **Partial portfolio updates**:
   - Some symbols may fail while others succeed
   - Check error messages in valuation results
   - Verify asset types are set correctly

3. **Cache issues**:
   - Prices cached for 5 minutes
   - Restart application to clear cache
   - Check timestamp of last price fetch

### Debugging

Enable detailed logging by checking console output during valuation updates. The system provides detailed logs for:
- Symbols being fetched
- Price retrieval results
- Portfolio calculation steps
- Error details for failed requests