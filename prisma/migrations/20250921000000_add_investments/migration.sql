-- Create enums for investment tracking
CREATE TYPE "InvestmentAssetClass" AS ENUM ('CRYPTO', 'EQUITY', 'MIXED');
CREATE TYPE "InvestmentAssetType" AS ENUM ('CRYPTO', 'EQUITY');
CREATE TYPE "InvestmentTransactionType" AS ENUM ('BUY', 'SELL', 'DEPOSIT', 'WITHDRAW', 'DIVIDEND', 'INTEREST', 'FEE', 'ADJUSTMENT');
CREATE TYPE "InvestmentAccountKind" AS ENUM ('BROKERAGE', 'WALLET');

-- Create investment account table referencing financial accounts
CREATE TABLE "InvestmentAccount" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "assetClass" "InvestmentAssetClass" NOT NULL,
    "kind" "InvestmentAccountKind" NOT NULL DEFAULT 'BROKERAGE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "InvestmentAccount_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "InvestmentAccount_accountId_key" UNIQUE ("accountId"),
    CONSTRAINT "InvestmentAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "InvestmentAccount_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "FinancialAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "InvestmentAccount_userId_idx" ON "InvestmentAccount"("userId");

-- Create valuation history table
CREATE TABLE "InvestmentValuation" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "investmentAccountId" TEXT NOT NULL,
    "value" INTEGER NOT NULL,
    "asOf" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "InvestmentValuation_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "InvestmentValuation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "InvestmentValuation_investmentAccountId_fkey" FOREIGN KEY ("investmentAccountId") REFERENCES "InvestmentAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "InvestmentValuation_account_asOf_key" ON "InvestmentValuation"("investmentAccountId", "asOf");
CREATE INDEX "InvestmentValuation_user_asOf_idx" ON "InvestmentValuation"("userId", "asOf");

-- Create investment asset table
CREATE TABLE "InvestmentAsset" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "investmentAccountId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "symbol" TEXT,
    "type" "InvestmentAssetType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "InvestmentAsset_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "InvestmentAsset_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "InvestmentAsset_investmentAccountId_fkey" FOREIGN KEY ("investmentAccountId") REFERENCES "InvestmentAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "InvestmentAsset_user_account_idx" ON "InvestmentAsset"("userId", "investmentAccountId");
CREATE UNIQUE INDEX "InvestmentAsset_account_name_key" ON "InvestmentAsset"("investmentAccountId", "name");

-- Create investment transactions table
CREATE TABLE "InvestmentTransaction" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "investmentAccountId" TEXT NOT NULL,
    "investmentAssetId" TEXT,
    "type" "InvestmentTransactionType" NOT NULL,
    "assetType" "InvestmentAssetType",
    "symbol" TEXT,
    "quantity" DECIMAL(18,8),
    "pricePerUnit" DECIMAL(18,8),
    "amount" INTEGER NOT NULL,
    "fees" INTEGER,
    "notes" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "InvestmentTransaction_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "InvestmentTransaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "InvestmentTransaction_investmentAccountId_fkey" FOREIGN KEY ("investmentAccountId") REFERENCES "InvestmentAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "InvestmentTransaction_investmentAssetId_fkey" FOREIGN KEY ("investmentAssetId") REFERENCES "InvestmentAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "InvestmentTransaction_userId_account_date_idx" ON "InvestmentTransaction"("userId", "investmentAccountId", "occurredAt");
CREATE INDEX "InvestmentTransaction_investmentAssetId_idx" ON "InvestmentTransaction"("investmentAssetId");

-- Create asset valuations
CREATE TABLE "InvestmentAssetValuation" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "investmentAssetId" TEXT NOT NULL,
    "value" INTEGER NOT NULL,
    "quantity" DECIMAL(18,8),
    "asOf" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "InvestmentAssetValuation_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "InvestmentAssetValuation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "InvestmentAssetValuation_investmentAssetId_fkey" FOREIGN KEY ("investmentAssetId") REFERENCES "InvestmentAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "InvestmentAssetValuation_asset_asOf_key" ON "InvestmentAssetValuation"("investmentAssetId", "asOf");
CREATE INDEX "InvestmentAssetValuation_user_asOf_idx" ON "InvestmentAssetValuation"("userId", "asOf");
