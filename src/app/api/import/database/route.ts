import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedUser, unauthorizedResponse } from "@/lib/auth-helpers";
import type { InvestmentTransactionType, InvestmentAssetType } from "@/generated/prisma";

export async function POST(request: Request) {
  const user = await getAuthenticatedUser();
  if (!user?.id) {
    return unauthorizedResponse();
  }

  try {
    const body = await request.json();

    // Validate import data structure
    if (!body.data || !body.exportedAt || !body.userId) {
      return NextResponse.json(
        { error: "Invalid import data format" },
        { status: 400 }
      );
    }

    const importData = body.data;
    const importStats = {
      financialAccounts: 0,
      categories: 0,
      transactions: 0,
      transactionRules: 0,
      importTemplates: 0,
      budgetPeriods: 0,
      investmentAccounts: 0,
      investmentAssets: 0,
      investmentTransactions: 0,
      investmentValuations: 0,
      investmentAssetValuations: 0,
      skipped: 0,
      errors: [] as string[]
    };

    // Use a transaction to ensure data consistency
    await prisma.$transaction(async (tx) => {
      // Import Categories first (needed for other entities)
      if (importData.categories) {
        for (const category of importData.categories) {
          try {
            await tx.category.upsert({
              where: {
                userId_name: {
                  userId: user.id,
                  name: category.name
                }
              },
              update: {
                color: category.color,
                icon: category.icon,
                budgetLimit: category.budgetLimit,
                type: category.type
              },
              create: {
                userId: user.id,
                name: category.name,
                color: category.color,
                icon: category.icon,
                budgetLimit: category.budgetLimit,
                type: category.type,
                parentId: category.parentId
              }
            });
            importStats.categories++;
          } catch (error) {
            importStats.errors.push(`Category ${category.name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
          }
        }
      }

      // Import Financial Accounts
      if (importData.financialAccounts) {
        for (const account of importData.financialAccounts) {
          try {
            await tx.financialAccount.upsert({
              where: {
                id: account.id
              },
              update: {
                name: account.name,
                currency: account.currency,
                openingBalance: account.openingBalance,
                creditLimit: account.creditLimit,
                institution: account.institution,
                notes: account.notes,
                type: account.type,
                status: account.status
              },
              create: {
                id: account.id,
                userId: user.id,
                name: account.name,
                currency: account.currency,
                openingBalance: account.openingBalance,
                creditLimit: account.creditLimit,
                institution: account.institution,
                notes: account.notes,
                type: account.type,
                status: account.status
              }
            });
            importStats.financialAccounts++;

            // Import associated investment account if it exists
            if (account.investment) {
              await tx.investmentAccount.upsert({
                where: {
                  accountId: account.id
                },
                update: {
                  assetClass: account.investment.assetClass,
                  kind: account.investment.kind
                },
                create: {
                  id: account.investment.id,
                  userId: user.id,
                  accountId: account.id,
                  assetClass: account.investment.assetClass,
                  kind: account.investment.kind
                }
              });
              importStats.investmentAccounts++;
            }
          } catch (error) {
            importStats.errors.push(`Account ${account.name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
          }
        }
      }

      // Import Investment Assets
      if (importData.investmentAssets) {
        for (const asset of importData.investmentAssets) {
          try {
            await tx.investmentAsset.upsert({
              where: {
                id: asset.id
              },
              update: {
                name: asset.name,
                symbol: asset.symbol,
                type: asset.type
              },
              create: {
                id: asset.id,
                userId: user.id,
                investmentAccountId: asset.investmentAccountId,
                name: asset.name,
                symbol: asset.symbol,
                type: asset.type
              }
            });
            importStats.investmentAssets++;
          } catch (error) {
            importStats.errors.push(`Investment Asset ${asset.name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
          }
        }
      }

      // Import Transactions
      if (importData.transactions) {
        for (const transaction of importData.transactions) {
          try {
            await tx.transaction.upsert({
              where: {
                id: transaction.id
              },
              update: {
                date: new Date(transaction.date),
                amount: transaction.amount,
                description: transaction.description,
                memo: transaction.memo,
                reference: transaction.reference,
                merchant: transaction.merchant,
                pending: transaction.pending,
                status: transaction.status,
                importTag: transaction.importTag
              },
              create: {
                id: transaction.id,
                userId: user.id,
                accountId: transaction.accountId,
                date: new Date(transaction.date),
                amount: transaction.amount,
                description: transaction.description,
                memo: transaction.memo,
                reference: transaction.reference,
                merchant: transaction.merchant,
                pending: transaction.pending,
                status: transaction.status,
                importTag: transaction.importTag
              }
            });

            // Import transaction splits
            if (transaction.splits) {
              for (const split of transaction.splits) {
                await tx.transactionSplit.upsert({
                  where: {
                    id: split.id
                  },
                  update: {
                    amount: split.amount
                  },
                  create: {
                    id: split.id,
                    userId: user.id,
                    transactionId: transaction.id,
                    categoryId: split.categoryId,
                    amount: split.amount
                  }
                });
              }
            }

            importStats.transactions++;
          } catch (error) {
            importStats.errors.push(`Transaction ${transaction.description}: ${error instanceof Error ? error.message : 'Unknown error'}`);
          }
        }
      }

      // Import Transaction Rules
      if (importData.transactionRules) {
        for (const rule of importData.transactionRules) {
          try {
            await tx.transactionRule.upsert({
              where: {
                id: rule.id
              },
              update: {
                name: rule.name,
                categoryId: rule.categoryId,
                accountId: rule.accountId,
                descriptionStartsWith: rule.descriptionStartsWith,
                descriptionContains: rule.descriptionContains,
                amountEquals: rule.amountEquals,
                priority: rule.priority
              },
              create: {
                id: rule.id,
                userId: user.id,
                name: rule.name,
                categoryId: rule.categoryId,
                accountId: rule.accountId,
                descriptionStartsWith: rule.descriptionStartsWith,
                descriptionContains: rule.descriptionContains,
                amountEquals: rule.amountEquals,
                priority: rule.priority
              }
            });
            importStats.transactionRules++;
          } catch (error) {
            importStats.errors.push(`Rule ${rule.name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
          }
        }
      }

      // Import Import Templates
      if (importData.importTemplates) {
        for (const template of importData.importTemplates) {
          try {
            await tx.importTemplate.upsert({
              where: {
                userId_name: {
                  userId: user.id,
                  name: template.name
                }
              },
              update: {
                mappings: template.mappings
              },
              create: {
                id: template.id,
                userId: user.id,
                name: template.name,
                mappings: template.mappings
              }
            });
            importStats.importTemplates++;
          } catch (error) {
            importStats.errors.push(`Template ${template.name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
          }
        }
      }

      // Import Budget Periods
      if (importData.budgetPeriods) {
        for (const period of importData.budgetPeriods) {
          try {
            await tx.budgetPeriod.upsert({
              where: {
                userId_month_year: {
                  userId: user.id,
                  month: period.month,
                  year: period.year
                }
              },
              update: {
                notes: period.notes
              },
              create: {
                id: period.id,
                userId: user.id,
                month: period.month,
                year: period.year,
                notes: period.notes
              }
            });
            importStats.budgetPeriods++;
          } catch (error) {
            importStats.errors.push(`Budget Period ${period.year}-${period.month}: ${error instanceof Error ? error.message : 'Unknown error'}`);
          }
        }
      }

      // Import Investment Transactions
      if (importData.investmentTransactions) {
        for (const transaction of importData.investmentTransactions) {
          try {
            await tx.investmentTransaction.upsert({
              where: {
                id: transaction.id
              },
              update: {
                type: transaction.type as InvestmentTransactionType,
                assetType: transaction.assetType as InvestmentAssetType,
                symbol: transaction.symbol,
                quantity: transaction.quantity,
                pricePerUnit: transaction.pricePerUnit,
                amount: transaction.amount,
                fees: transaction.fees,
                notes: transaction.notes,
                occurredAt: new Date(transaction.occurredAt)
              },
              create: {
                id: transaction.id,
                userId: user.id,
                investmentAccountId: transaction.investmentAccountId,
                investmentAssetId: transaction.investmentAssetId,
                type: transaction.type as InvestmentTransactionType,
                assetType: transaction.assetType as InvestmentAssetType,
                symbol: transaction.symbol,
                quantity: transaction.quantity,
                pricePerUnit: transaction.pricePerUnit,
                amount: transaction.amount,
                fees: transaction.fees,
                notes: transaction.notes,
                occurredAt: new Date(transaction.occurredAt)
              }
            });
            importStats.investmentTransactions++;
          } catch (error) {
            importStats.errors.push(`Investment Transaction ${transaction.symbol || 'Unknown'}: ${error instanceof Error ? error.message : 'Unknown error'}`);
          }
        }
      }

      // Import Investment Valuations
      if (importData.investmentValuations) {
        for (const valuation of importData.investmentValuations) {
          try {
            await tx.investmentValuation.upsert({
              where: {
                investmentAccountId_asOf: {
                  investmentAccountId: valuation.investmentAccountId,
                  asOf: new Date(valuation.asOf)
                }
              },
              update: {
                value: valuation.value
              },
              create: {
                id: valuation.id,
                userId: user.id,
                investmentAccountId: valuation.investmentAccountId,
                value: valuation.value,
                asOf: new Date(valuation.asOf)
              }
            });
            importStats.investmentValuations++;
          } catch (error) {
            importStats.errors.push(`Investment Valuation: ${error instanceof Error ? error.message : 'Unknown error'}`);
          }
        }
      }

      // Import Investment Asset Valuations
      if (importData.investmentAssetValuations) {
        for (const valuation of importData.investmentAssetValuations) {
          try {
            await tx.investmentAssetValuation.upsert({
              where: {
                investmentAssetId_asOf: {
                  investmentAssetId: valuation.investmentAssetId,
                  asOf: new Date(valuation.asOf)
                }
              },
              update: {
                value: valuation.value,
                quantity: valuation.quantity
              },
              create: {
                id: valuation.id,
                userId: user.id,
                investmentAssetId: valuation.investmentAssetId,
                value: valuation.value,
                quantity: valuation.quantity,
                asOf: new Date(valuation.asOf)
              }
            });
            importStats.investmentAssetValuations++;
          } catch (error) {
            importStats.errors.push(`Asset Valuation: ${error instanceof Error ? error.message : 'Unknown error'}`);
          }
        }
      }
    });

    const totalImported = importStats.financialAccounts +
      importStats.categories +
      importStats.transactions +
      importStats.transactionRules +
      importStats.importTemplates +
      importStats.budgetPeriods +
      importStats.investmentAccounts +
      importStats.investmentAssets +
      importStats.investmentTransactions +
      importStats.investmentValuations +
      importStats.investmentAssetValuations;

    return NextResponse.json({
      success: true,
      message: `Successfully imported ${totalImported} records. ${importStats.errors.length > 0 ? `${importStats.errors.length} errors encountered.` : ''}`,
      stats: importStats
    });

  } catch (error) {
    console.error('Database import error:', error);
    return NextResponse.json(
      { error: 'Failed to import database: ' + (error instanceof Error ? error.message : 'Unknown error') },
      { status: 500 }
    );
  }
}