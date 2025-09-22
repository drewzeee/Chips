import { Prisma } from "@/generated/prisma";

interface UpsertInvestmentValuationArgs {
  tx: Prisma.TransactionClient;
  userId: string;
  investmentAccountId: string;
  financialAccountId: string;
  openingBalance: number;
  asOf: Date;
  value: number;
}

export async function upsertInvestmentAccountValuation({
  tx,
  userId,
  investmentAccountId,
  financialAccountId,
  openingBalance,
  asOf,
  value,
}: UpsertInvestmentValuationArgs) {
  const totals = await tx.transaction.aggregate({
    where: {
      userId,
      accountId: financialAccountId,
      date: {
        lte: asOf,
      },
    },
    _sum: { amount: true },
  });

  const currentValue = openingBalance + (totals._sum.amount ?? 0);
  const difference = value - currentValue;

  const valuation = await tx.investmentValuation.upsert({
    where: {
      investmentAccountId_asOf: {
        investmentAccountId,
        asOf,
      },
    },
    update: {
      value,
    },
    create: {
      userId,
      investmentAccountId,
      value,
      asOf,
    },
  });

  const reference = `investment_valuation_${valuation.id}`;

  const existingAdjustment = await tx.transaction.findFirst({
    where: {
      userId,
      accountId: financialAccountId,
      reference,
    },
  });

  const newAmount = (existingAdjustment?.amount ?? 0) + difference;

  if (existingAdjustment) {
    if (newAmount === 0) {
      await tx.transaction.delete({ where: { id: existingAdjustment.id } });
    } else {
      await tx.transaction.update({
        where: { id: existingAdjustment.id },
        data: {
          amount: newAmount,
          date: asOf,
        },
      });
    }
  } else if (difference !== 0) {
    await tx.transaction.create({
      data: {
        userId,
        accountId: financialAccountId,
        date: asOf,
        amount: difference,
        description: "Valuation Adjustment",
        status: "CLEARED",
        reference,
      },
    });
  }

  return valuation;
}
