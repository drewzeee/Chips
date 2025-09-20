# Personal Financial Portal

A self-hosted personal finance portal that centralises budgeting, transaction management, and investment tracking. The MVP implemented here covers the Phase 1 requirements from the PRD: authentication, account management, transaction CRUD, CSV imports with column mapping, manual categorisation, dashboards, and monthly reporting.

## Tech Stack

- **Next.js 15** with the App Router
- **TypeScript** and **Tailwind CSS 4** for the UI
- **Prisma ORM** with Supabase (PostgreSQL) for persistence
- **Next-Auth** credentials provider for secure email / password authentication
- **Recharts** for data visualisations
- **Papa Parse** for client-side CSV parsing

## Features Delivered

- Email/password authentication with account bootstrap (default categories and accounts)
- Dashboard with net worth, income/expense summaries, budget progress, and recent activity
- Account management (create, edit, delete) with balance calculations
- Category manager supporting hierarchies, colour coding, and monthly budgets
- Transaction workspace with filtering, search, bulk splits, and inline status management
- Seamless account-to-account transfers that keep ledgers in sync without affecting budgets
- Automatic detection of mirrored debit/credit payments (e.g. credit card payoffs) with optional manual overrides
- Review modal to manually pair unmatched transactions in-place
- Slide-in drawers for adding or editing transactions/transfers on demand
- CSV import wizard with saved mapping templates and duplicate detection
- Rule-based auto-categorisation engine with priority ordering and optional account/description/amount matchers (managed in Settings)
- Monthly reporting with comparative analytics, category breakdowns, and merchant insights

## Prerequisites

- Node.js 20+
- npm (installed with Node.js)
- Access to a Supabase-compatible PostgreSQL instance (the project defaults to `http://192.168.50.101:8000`)

## Getting Started

```bash
# Install dependencies
npm install

# Copy the environment template and update it
cp .env.example .env
# Set NEXTAUTH_SECRET to any strong random value and adjust the Supabase credentials if needed.

# Apply migrations to Supabase
npm run db:init

# Generate the Prisma client
npx prisma generate

# Start the development server
npm run dev
```

Visit `http://localhost:3000` and create your first user account. The registration flow seeds default categories and two starter accounts (Checking, Cash).

## Project Structure

```text
src/
  app/
    (auth)/           Authentication pages
    (protected)/      Dashboard, accounts, categories, transactions, reports, settings
    api/              REST endpoints for auth, accounts, categories, transactions, import
  components/         UI primitives and feature modules
  lib/                Prisma client, dashboard helpers, Next-Auth config, validators, utilities
  types/              Type augmentations (Next-Auth)
prisma/
  schema.prisma       Prisma data model
  migrations/         Prisma migration history
```

## Auto-Categorisation Rules

- Add and manage rules from **Settings → Auto-categorisation rules**.
- Each rule can target a specific account (or all), match descriptions that start with and/or contain text, and optionally require an exact amount.
- Amount comparisons ignore the sign, so `-125.40` and `125.40` are treated the same.
- Rules execute in ascending priority order (lower number runs first); the first match wins and applies the linked category as a single split for the full transaction amount.
- Updates and deletions take effect immediately and apply to future imports or manual entries; existing transactions can be reprocessed by editing them.
- Use **Test run** beside any rule to preview the first 50 matching transactions and confirm the bulk update before applying the rule to your history.

## Environment Variables

| Variable         | Description                                      |
| ---------------- | ------------------------------------------------ |
| `DATABASE_URL`   | Prisma connection string (defaults to Supabase Postgres) |
| `DIRECT_DATABASE_URL` | Optional direct Postgres connection (used for migrations) |
| `NEXTAUTH_SECRET`| Random string used to sign Next-Auth JWTs         |
| `NEXTAUTH_URL`   | Base URL for Next-Auth callbacks (e.g. localhost) |

## Available Scripts

- `npm run dev` – start the Next.js development server
- `npm run build` – build for production
- `npm run start` – start the production server
- `npm run lint` – run ESLint
- `npm run db:init` – run Prisma migrations against the configured Supabase instance

## Notes & Next Steps

- The CSV import wizard stores mapping templates per user; manage them from **Settings → Import templates**.
- Additional roadmap items (machine-learning suggestions, advanced analytics, market data) can be layered on top of this foundation.
- When deploying beyond local development, swap SQLite for Postgres/MySQL and update `schema.prisma` accordingly.
