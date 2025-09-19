# Personal Financial Portal - Product Requirements Document (PRD)

## 1. Executive Summary

### 1.1 Product Overview
A self-hosted personal financial management portal providing comprehensive tools for budget tracking and investment monitoring through intuitive dashboards and visualizations.

### 1.2 Objectives
- Centralize personal financial data in a secure, self-hosted environment
- Provide actionable insights through automated categorization and visualization
- Simplify transaction management across multiple accounts
- Enable informed financial decision-making through real-time analytics

### 1.3 Success Metrics
- Time to import and categorize transactions < 2 minutes per 100 transactions
- All dashboards load within 2 seconds
- Zero external dependencies for core functionality
- 100% data ownership and privacy

## 2. User Personas

### Primary Persona: Self-Hosting Enthusiast
- **Profile**: Tech-savvy individual who values data privacy and control
- **Goals**: Complete financial visibility without relying on third-party services
- **Pain Points**: Current tools require manual data entry or share data with external services
- **Technical Skill**: Comfortable with Docker, basic server administration

## 3. Functional Requirements

### 3.1 Core Applications

#### 3.1.1 Budget Application

**Transaction Management**
- **CSV Import**
  - Support multiple CSV formats (bank exports, credit card statements)
  - Configurable column mapping with saved templates per account
  - Duplicate detection based on date/amount/description
  - Bulk import with preview and validation
  - Error handling with detailed import reports

- **Manual Entry**
  - Quick entry form with autocomplete for merchants/payees
  - Keyboard shortcuts for power users
  - Mobile-responsive design for on-the-go entry
  - Receipt attachment capability (optional)

- **Transaction Operations**
  - Edit single or bulk transactions
  - Split transactions across categories
  - Mark as pending/cleared/reconciled
  - Add notes and tags
  - Search and filter capabilities

**Categorization System**
- **Category Management**
  - Hierarchical categories (up to 3 levels deep)
  - Custom colors and icons per category
  - Monthly/yearly budget limits per category
  - Income vs expense categories

- **Auto-categorization**
  - Rule-based engine using merchant/description patterns
  - Machine learning suggestions based on history (Phase 2)
  - Bulk apply categories with smart selection
  - Override and training capabilities

**Account Management**
- **Account Types**
  - Checking, Savings, Credit Card, Cash, Investment
  - Multi-currency support with conversion rates
  - Opening balance and reconciliation tracking
  - Account status (active/closed/hidden)

- **Account Features**
  - Running balance calculation
  - Statement reconciliation workflow
  - Interest/fee tracking
  - Credit limit and utilization for credit cards

**Visualizations & Reports**
- **Dashboard Views**
  - Month/Year/Custom date range selector
  - Net worth trend over time
  - Income vs Expenses summary
  - Top spending categories
  - Budget progress indicators
  - Cash flow forecast

- **Detailed Reports**
  - Category breakdown with drill-down
  - Merchant analysis
  - Trend analysis with YoY/MoM comparisons
  - Budget variance reports
  - Custom report builder (Phase 2)

#### 3.1.2 Investment Application

**Portfolio Management**
- **Holdings Tracking**
  - Manual position entry
  - CSV import for brokerage statements
  - Cost basis tracking (FIFO/LIFO/Specific lots)
  - Dividend and distribution tracking

- **Performance Metrics**
  - Total/Unrealized/Realized gains
  - Time-weighted and money-weighted returns
  - Asset allocation analysis
  - Sector/Geographic diversification

**Market Data Integration**
- **Price Updates**
  - Daily price fetching (configurable providers)
  - Historical price data storage
  - Corporate action handling (splits, dividends)
  - Currency conversion for international holdings

**Investment Visualizations**
- **Portfolio Views**
  - Current allocation pie/treemap
  - Performance over time vs benchmarks
  - Individual holding performance
  - Rebalancing suggestions
  - Tax lot viewer

### 3.2 System Features

#### 3.2.1 Authentication & Security
- Local authentication with bcrypt password hashing
- Optional 2FA with TOTP
- Session management with configurable timeout
- API key support for external integrations
- Audit log for all data modifications

#### 3.2.2 Data Management
- **Backup & Restore**
  - Automated daily backups
  - Point-in-time recovery
  - Export to common formats (CSV, JSON, QIF)
  - Encrypted backup option

- **Data Privacy**
  - All data stored locally
  - No external API calls without explicit permission
  - Configurable data retention policies
  - GDPR-compliant data export/deletion

#### 3.2.3 Integrations (Optional)
- **Import Connectors**
  - Plaid API (opt-in)
  - Open Banking APIs
  - Email statement parsing
  - OCR for receipt scanning

- **Export Capabilities**
  - Tax software formats
  - Accounting software compatibility
  - PDF report generation
  - API for custom integrations

## 4. Non-Functional Requirements

### 4.1 Performance
- Page load time < 2 seconds for dashboards
- Support 5 years of transaction history (~ 10,000 transactions)
- Real-time updates without page refresh
- Responsive design for mobile/tablet/desktop

### 4.2 Reliability
- 99.9% uptime (self-hosted consideration)
- Graceful degradation when external services unavailable
- Data integrity validation
- Automatic error recovery

### 4.3 Usability
- Intuitive navigation with breadcrumbs
- Contextual help and tooltips
- Keyboard navigation support
- Accessibility (WCAG 2.1 AA compliance)
- Dark/Light theme support

### 4.4 Scalability
- Support multiple users (family members) in Phase 2
- Efficient handling of large CSV imports (10,000+ rows)
- Modular architecture for feature additions

## 5. Technical Architecture

### 5.1 Technology Stack
```
Frontend:
- Next.js 14+ (React framework)
- TypeScript (type safety)
- Tailwind CSS (styling)
- Shadcn/ui (component library)
- Recharts/Tremor (visualizations)
- React Hook Form (forms)
- Tanstack Query (state management)
- Papaparse (CSV parsing)

Backend:
- Supabase (self-hosted)
  - PostgreSQL 15+ (database)
  - PostgREST (API layer)
  - Realtime (websockets)
  - GoTrue (authentication)
  - Storage (file uploads)

Infrastructure:
- Docker & Docker Compose
- Nginx (reverse proxy)
- Let's Encrypt (SSL)
- PM2/systemd (process management)
```

### 5.2 Database Schema

```sql
-- Core Tables
accounts (
  id UUID PRIMARY KEY,
  name VARCHAR(255),
  type ENUM('checking','savings','credit','cash','investment'),
  currency VARCHAR(3),
  initial_balance DECIMAL(15,2),
  current_balance DECIMAL(15,2),
  is_active BOOLEAN,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
)

categories (
  id UUID PRIMARY KEY,
  name VARCHAR(255),
  parent_id UUID REFERENCES categories(id),
  type ENUM('income','expense'),
  color VARCHAR(7),
  icon VARCHAR(50),
  budget_monthly DECIMAL(10,2),
  budget_yearly DECIMAL(10,2),
  sort_order INTEGER
)

transactions (
  id UUID PRIMARY KEY,
  account_id UUID REFERENCES accounts(id),
  date DATE,
  amount DECIMAL(15,2),
  description TEXT,
  merchant VARCHAR(255),
  status ENUM('pending','cleared','reconciled'),
  import_id VARCHAR(255), -- for duplicate detection
  notes TEXT,
  created_at TIMESTAMP,
  updated_at TIMESTAMP,
  UNIQUE(account_id, date, amount, description) -- duplicate prevention
)

transaction_categories (
  transaction_id UUID REFERENCES transactions(id),
  category_id UUID REFERENCES categories(id),
  amount DECIMAL(15,2), -- for split transactions
  PRIMARY KEY (transaction_id, category_id)
)

-- Investment Tables
holdings (
  id UUID PRIMARY KEY,
  account_id UUID REFERENCES accounts(id),
  symbol VARCHAR(20),
  quantity DECIMAL(15,4),
  cost_basis DECIMAL(15,2),
  purchase_date DATE,
  lot_id VARCHAR(100)
)

price_history (
  symbol VARCHAR(20),
  date DATE,
  open DECIMAL(15,4),
  high DECIMAL(15,4),
  low DECIMAL(15,4),
  close DECIMAL(15,4),
  volume BIGINT,
  PRIMARY KEY (symbol, date)
)

-- Supporting Tables
import_templates (
  id UUID PRIMARY KEY,
  name VARCHAR(255),
  account_id UUID REFERENCES accounts(id),
  column_mapping JSONB,
  date_format VARCHAR(50),
  delimiter VARCHAR(5)
)

categorization_rules (
  id UUID PRIMARY KEY,
  pattern VARCHAR(255),
  pattern_type ENUM('exact','contains','regex'),
  category_id UUID REFERENCES categories(id),
  priority INTEGER
)

audit_log (
  id UUID PRIMARY KEY,
  table_name VARCHAR(100),
  record_id UUID,
  action ENUM('insert','update','delete'),
  old_values JSONB,
  new_values JSONB,
  user_id UUID,
  timestamp TIMESTAMP
)
```

### 5.3 API Design

**RESTful Endpoints**
```
# Transactions
GET    /api/transactions
POST   /api/transactions
PUT    /api/transactions/:id
DELETE /api/transactions/:id
POST   /api/transactions/import
POST   /api/transactions/bulk-categorize

# Categories
GET    /api/categories
POST   /api/categories
PUT    /api/categories/:id
DELETE /api/categories/:id

# Accounts
GET    /api/accounts
POST   /api/accounts
PUT    /api/accounts/:id
GET    /api/accounts/:id/balance-history

# Reports
GET    /api/reports/dashboard
GET    /api/reports/cash-flow
GET    /api/reports/budget-variance
GET    /api/reports/net-worth

# Investments
GET    /api/holdings
POST   /api/holdings
GET    /api/market-data/:symbol
```

## 6. User Interface Design

### 6.1 Information Architecture
```
/
├── Dashboard (Overview)
├── Budget/
│   ├── Transactions
│   ├── Accounts
│   ├── Categories
│   └── Reports/
│       ├── Monthly Summary
│       ├── Category Analysis
│       └── Cash Flow
├── Investments/
│   ├── Portfolio
│   ├── Holdings
│   ├── Performance
│   └── Transactions
├── Settings/
│   ├── Profile
│   ├── Import Templates
│   ├── Categorization Rules
│   ├── Backup & Export
│   └── Security
```

### 6.2 Key Screens

**Dashboard**
- Summary cards (Net Worth, Monthly Income/Expense, Budget Status)
- Recent transactions list
- Quick actions (Add Transaction, Import CSV)
- Mini charts for key metrics

**Transaction List**
- Filterable/sortable table
- Inline editing
- Bulk selection and actions
- Search with autocomplete
- Date range picker

**Import Wizard**
- Step 1: File upload
- Step 2: Column mapping
- Step 3: Preview and duplicate detection
- Step 4: Confirmation and import

**Budget Analysis**
- Category breakdown (hierarchical view)
- Budget vs Actual gauges
- Trend charts
- Drill-down capability

## 7. Implementation Roadmap

### Phase 1: MVP (Months 1-2)
- [ ] Basic authentication
- [ ] Account management
- [ ] Transaction CRUD operations
- [ ] CSV import with mapping
- [ ] Manual categorization
- [ ] Basic dashboard
- [ ] Simple reports (monthly summary)

### Phase 2: Enhanced Features (Months 3-4)
- [ ] Auto-categorization rules
- [ ] Advanced filtering/search
- [ ] Budget tracking and alerts
- [ ] Investment portfolio basics
- [ ] Backup/restore functionality
- [ ] Mobile responsive design

### Phase 3: Advanced Analytics (Months 5-6)
- [ ] Custom report builder
- [ ] Cash flow forecasting
- [ ] Investment performance tracking
- [ ] Market data integration
- [ ] Tax report generation
- [ ] API for external access

### Phase 4: Polish & Scale (Months 7+)
- [ ] Multi-user support
- [ ] Advanced security (2FA, audit logs)
- [ ] Plugin system for extensions
- [ ] Machine learning categorization
- [ ] Receipt OCR
- [ ] Mobile app (React Native)

## 8. Testing Strategy

### 8.1 Test Coverage Requirements
- Unit tests: 80% coverage minimum
- Integration tests for all API endpoints
- E2E tests for critical user flows
- Performance testing for large datasets

### 8.2 Test Scenarios
- CSV import with various bank formats
- Bulk transaction operations (1000+ items)
- Concurrent user access
- Data integrity during imports
- Calculation accuracy for reports

## 9. Security Considerations

- **Data Encryption**: At-rest encryption for database
- **Input Validation**: Sanitize all user inputs
- **SQL Injection Prevention**: Use parameterized queries
- **XSS Protection**: Content Security Policy headers
- **Rate Limiting**: Protect against brute force
- **Secure Headers**: HSTS, X-Frame-Options, etc.
- **Regular Updates**: Automated dependency updates

## 10. Success Criteria

### Launch Criteria
- [ ] All Phase 1 features implemented
- [ ] 95% test coverage
- [ ] Performance benchmarks met
- [ ] Security audit passed
- [ ] Documentation complete
- [ ] Docker deployment tested

### Long-term Success Metrics
- Daily active usage
- < 5 minutes to categorize weekly transactions
- Zero data loss incidents
- Successful backup/restore operations
- Positive user feedback on usability

---

This PRD serves as the living document for the Personal Financial Portal development. It should be updated as requirements evolve and new insights are gained during implementation.