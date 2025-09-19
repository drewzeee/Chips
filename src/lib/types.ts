import type { Prisma } from "@/generated/prisma";

export type Transaction = Prisma.TransactionGetPayload<{ include: { account: true } }>;
export type FinancialAccount = Prisma.FinancialAccountGetPayload<Prisma.FinancialAccountDefaultArgs>;
export type TransactionRule = Prisma.TransactionRuleGetPayload<{
  include: { category: true; account: true };
}>;
