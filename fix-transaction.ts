import { prisma } from './src/lib/prisma';

async function fixTransaction() {
  const transactionId = 'cmfu4h55p034x8oap547111ab';

  // Find the problematic transaction
  const transaction = await prisma.transaction.findUnique({
    where: { id: transactionId },
    include: {
      account: {
        include: {
          investment: true
        }
      }
    }
  });

  if (!transaction) {
    console.log(`Transaction ${transactionId} not found`);
    return;
  }

  console.log('Found transaction:', {
    id: transaction.id,
    accountId: transaction.accountId,
    accountName: transaction.account.name,
    amount: transaction.amount,
    description: transaction.description,
    date: transaction.date,
    isInvestmentAccount: !!transaction.account.investment,
    investmentAccountId: transaction.account.investment?.id
  });

  // Check if this is part of a transfer (has a counterpart)
  const counterpartTransaction = await prisma.transaction.findFirst({
    where: {
      reference: transaction.reference,
      id: { not: transaction.id }
    },
    include: {
      account: {
        include: {
          investment: true
        }
      }
    }
  });

  if (counterpartTransaction) {
    console.log('Found counterpart transaction:', {
      id: counterpartTransaction.id,
      accountId: counterpartTransaction.accountId,
      accountName: counterpartTransaction.account.name,
      amount: counterpartTransaction.amount,
      description: counterpartTransaction.description,
      isInvestmentAccount: !!counterpartTransaction.account.investment,
      investmentAccountId: counterpartTransaction.account.investment?.id
    });
  }

  // Check if investment transactions already exist
  if (transaction.account.investment) {
    const existingInvestmentTx = await prisma.investmentTransaction.findFirst({
      where: {
        investmentAccountId: transaction.account.investment.id,
        occurredAt: transaction.date,
        amount: transaction.amount
      }
    });

    if (existingInvestmentTx) {
      console.log('Investment transaction already exists for this account');
    } else {
      console.log('Missing investment transaction for investment account');

      // Create the missing investment transaction
      const investmentTransactionType = transaction.amount < 0 ? 'WITHDRAW' : 'DEPOSIT';

      await prisma.investmentTransaction.create({
        data: {
          userId: transaction.userId,
          investmentAccountId: transaction.account.investment.id,
          type: investmentTransactionType,
          amount: transaction.amount,
          occurredAt: transaction.date,
          notes: transaction.description
        }
      });

      console.log(`Created ${investmentTransactionType} investment transaction`);
    }
  }

  if (counterpartTransaction?.account.investment) {
    const existingInvestmentTx = await prisma.investmentTransaction.findFirst({
      where: {
        investmentAccountId: counterpartTransaction.account.investment.id,
        occurredAt: counterpartTransaction.date,
        amount: counterpartTransaction.amount
      }
    });

    if (existingInvestmentTx) {
      console.log('Investment transaction already exists for counterpart account');
    } else {
      console.log('Missing investment transaction for counterpart investment account');

      // Create the missing investment transaction
      const investmentTransactionType = counterpartTransaction.amount < 0 ? 'WITHDRAW' : 'DEPOSIT';

      await prisma.investmentTransaction.create({
        data: {
          userId: counterpartTransaction.userId,
          investmentAccountId: counterpartTransaction.account.investment.id,
          type: investmentTransactionType,
          amount: counterpartTransaction.amount,
          occurredAt: counterpartTransaction.date,
          notes: counterpartTransaction.description
        }
      });

      console.log(`Created ${investmentTransactionType} investment transaction for counterpart`);
    }
  }
}

fixTransaction()
  .then(() => {
    console.log('Fix completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Error fixing transaction:', error);
    process.exit(1);
  });