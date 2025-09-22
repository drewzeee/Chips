import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedUser, unauthorizedResponse } from "@/lib/auth-helpers";

export async function GET() {
  const user = await getAuthenticatedUser();
  if (!user?.id) {
    return unauthorizedResponse();
  }

  try {
    // Export all user data in a structured format
    const exportData = {
      exportedAt: new Date().toISOString(),
      userId: user.id,
      userEmail: user.email,
      data: {
        // Financial Accounts
        financialAccounts: await prisma.financialAccount.findMany({
          where: { userId: user.id },
          include: {
            investment: {
              include: {
                assets: {
                  include: {
                    valuations: true,
                    transactions: true
                  }
                },
                trades: true,
                valuations: true
              }
            }
          }
        }),

        // Categories
        categories: await prisma.category.findMany({
          where: { userId: user.id }
        }),

        // Transactions and Splits
        transactions: await prisma.transaction.findMany({
          where: { userId: user.id },
          include: {
            splits: {
              include: {
                category: true
              }
            }
          },
          orderBy: { date: 'asc' }
        }),

        // Transaction Rules
        transactionRules: await prisma.transactionRule.findMany({
          where: { userId: user.id },
          include: {
            account: true,
            category: true
          }
        }),

        // Import Templates
        importTemplates: await prisma.importTemplate.findMany({
          where: { userId: user.id }
        }),

        // Budget Periods
        budgetPeriods: await prisma.budgetPeriod.findMany({
          where: { userId: user.id }
        }),

        // Investment Accounts (detailed)
        investmentAccounts: await prisma.investmentAccount.findMany({
          where: { userId: user.id },
          include: {
            account: true,
            assets: {
              include: {
                valuations: true,
                transactions: true
              }
            },
            trades: true,
            valuations: true
          }
        }),

        // Investment Assets
        investmentAssets: await prisma.investmentAsset.findMany({
          where: { userId: user.id },
          include: {
            valuations: true,
            transactions: true,
            account: true
          }
        }),

        // Investment Transactions
        investmentTransactions: await prisma.investmentTransaction.findMany({
          where: { userId: user.id },
          include: {
            account: true,
            asset: true
          },
          orderBy: { occurredAt: 'asc' }
        }),

        // Investment Valuations
        investmentValuations: await prisma.investmentValuation.findMany({
          where: { userId: user.id },
          include: {
            account: true
          },
          orderBy: { asOf: 'asc' }
        }),

        // Investment Asset Valuations
        investmentAssetValuations: await prisma.investmentAssetValuation.findMany({
          where: { userId: user.id },
          include: {
            asset: true
          },
          orderBy: { asOf: 'asc' }
        })
      }
    };

    // Generate filename with timestamp
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `chips-database-export-${timestamp}.json`;

    // Return as downloadable JSON file
    return new NextResponse(JSON.stringify(exportData, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-cache'
      }
    });

  } catch (error) {
    console.error('Database export error:', error);
    return NextResponse.json(
      { error: 'Failed to export database' },
      { status: 500 }
    );
  }
}