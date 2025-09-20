-- AlterTable
ALTER TABLE "chips"."AccountBalanceSnapshot" ALTER COLUMN "asOf" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3);

-- CreateTable
CREATE TABLE "chips"."ExternalBalanceSnapshot" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "amount" DECIMAL(65,30) NOT NULL,
    "usdValue" DECIMAL(65,30) NOT NULL,
    "asOf" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExternalBalanceSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ExternalBalanceSnapshot_userId_asOf_idx" ON "chips"."ExternalBalanceSnapshot"("userId", "asOf");

-- CreateIndex
CREATE UNIQUE INDEX "ExternalBalanceSnapshot_userId_source_currency_asOf_key" ON "chips"."ExternalBalanceSnapshot"("userId", "source", "currency", "asOf");

-- AddForeignKey
ALTER TABLE "chips"."ExternalBalanceSnapshot" ADD CONSTRAINT "ExternalBalanceSnapshot_userId_fkey" FOREIGN KEY ("userId") REFERENCES "chips"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
