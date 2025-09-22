/*
  Warnings:

  - The `type` column on the `Category` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `status` column on the `FinancialAccount` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `status` column on the `Transaction` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - Changed the type of `type` on the `FinancialAccount` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "chips"."AccountType" AS ENUM ('CHECKING', 'SAVINGS', 'CREDIT_CARD', 'CASH', 'INVESTMENT');

-- CreateEnum
CREATE TYPE "chips"."AccountStatus" AS ENUM ('ACTIVE', 'CLOSED', 'HIDDEN');

-- CreateEnum
CREATE TYPE "chips"."TransactionStatus" AS ENUM ('PENDING', 'CLEARED', 'RECONCILED');

-- CreateEnum
CREATE TYPE "chips"."CategoryType" AS ENUM ('INCOME', 'EXPENSE', 'TRANSFER');

-- AlterTable
ALTER TABLE "chips"."Category" DROP COLUMN "type",
ADD COLUMN     "type" "chips"."CategoryType" NOT NULL DEFAULT 'EXPENSE';

-- AlterTable
ALTER TABLE "chips"."FinancialAccount" DROP COLUMN "type",
ADD COLUMN     "type" "chips"."AccountType" NOT NULL,
DROP COLUMN "status",
ADD COLUMN     "status" "chips"."AccountStatus" NOT NULL DEFAULT 'ACTIVE';

-- AlterTable
ALTER TABLE "chips"."Transaction" DROP COLUMN "status",
ADD COLUMN     "status" "chips"."TransactionStatus" NOT NULL DEFAULT 'PENDING';
