ALTER TABLE "FinancialAccount"
ADD COLUMN "externalAccountId" TEXT;

CREATE TABLE "AccountBalanceSnapshot" (
    "id" TEXT PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "balance" INTEGER NOT NULL,
    "asOf" TIMESTAMP WITH TIME ZONE NOT NULL,
    "source" TEXT,
    "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    CONSTRAINT "AccountBalanceSnapshot_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "FinancialAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AccountBalanceSnapshot_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "AccountBalanceSnapshot_accountId_asOf_key" ON "AccountBalanceSnapshot"("accountId", "asOf");
CREATE INDEX "AccountBalanceSnapshot_userId_asOf_idx" ON "AccountBalanceSnapshot"("userId", "asOf");
