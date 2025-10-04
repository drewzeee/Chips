"use client";

import { useEffect, useState } from "react";
import { formatCurrency } from "@/lib/utils";
import { getAssetDisplayName, formatAssetPrice } from "@/lib/asset-prices";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import type { AccountLedger } from "@/app/api/investments/accounts/[id]/ledger/route";

interface AccountLedgerProps {
  investmentAccountId: string;
  onBack: () => void;
}

export function AccountLedgerView({ investmentAccountId, onBack }: AccountLedgerProps) {
  const [ledger, setLedger] = useState<AccountLedger | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadLedger();
  }, [investmentAccountId]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadLedger = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`/api/investments/accounts/${investmentAccountId}/ledger`);

      if (!response.ok) {
        const result = await response.json().catch(() => null);
        throw new Error(result?.error ?? "Failed to load account ledger");
      }

      const data = await response.json();
      setLedger(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load ledger");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="secondary" onClick={onBack}>← Back</Button>
          <div>
            <h1 className="text-2xl font-semibold text-[var(--foreground)]">Loading Account Ledger...</h1>
          </div>
        </div>
      </div>
    );
  }

  if (error || !ledger) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="secondary" onClick={onBack}>← Back</Button>
          <div>
            <h1 className="text-2xl font-semibold text-[var(--foreground)]">Error</h1>
            <p className="text-sm text-[var(--destructive)]">{error || "Failed to load ledger"}</p>
          </div>
        </div>
      </div>
    );
  }

  const formatGainLoss = (value: number) => {
    const isPositive = value >= 0;
    const color = isPositive ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400";
    const sign = isPositive ? "+" : "";
    return <span className={color}>{sign}${Math.round(Math.abs(value) * 100).toLocaleString()}</span>;
  };

  const formatGainLossPercent = (value: number) => {
    const isPositive = value >= 0;
    const color = isPositive ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400";
    const sign = isPositive ? "+" : "";
    return <span className={color}>{sign}{value.toFixed(2)}%</span>;
  };

  const formatChange24h = (value: number) => {
    const isPositive = value >= 0;
    const color = isPositive ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400";
    const sign = isPositive ? "+" : "";
    return <span className={color}>{sign}${Math.round(Math.abs(value) * 100).toLocaleString()}</span>;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="secondary" onClick={onBack}>← Back</Button>
        <div>
          <h1 className="text-2xl font-semibold text-[var(--foreground)]">{ledger.accountName}</h1>
          <p className="text-sm text-[var(--muted-foreground)]">
            {ledger.kind === "WALLET" ? "Wallet" : "Brokerage"} • {ledger.assetClass} Assets
          </p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-[var(--muted-foreground)]">Total Value</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-[var(--foreground)]">
              {formatCurrency(ledger.totalValue * 100, ledger.currency)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-[var(--muted-foreground)]">Cost Basis</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-[var(--foreground)]">
              {formatCurrency(ledger.totalCostBasis * 100, ledger.currency)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-[var(--muted-foreground)]">Unrealized P&L</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {formatGainLoss(ledger.totalUnrealizedGainLoss)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-[var(--muted-foreground)]">Return %</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {formatGainLossPercent(ledger.totalUnrealizedGainLossPercent)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Cash Position */}
      {ledger.cashPosition.balance !== 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Cash Position</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-lg font-semibold text-[var(--foreground)]">Cash Balance</p>
                <p className="text-sm text-[var(--muted-foreground)]">{ledger.currency}</p>
              </div>
              <p className="text-2xl font-bold text-[var(--foreground)]">
                {formatCurrency(ledger.cashPosition.balance * 100, ledger.currency)}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Holdings */}
      <Card>
        <CardHeader>
          <CardTitle>Current Holdings</CardTitle>
        </CardHeader>
        <CardContent>
          {ledger.holdings.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHead>
                  <TableRow>
                    <TableHeaderCell>Asset</TableHeaderCell>
                    <TableHeaderCell>Quantity</TableHeaderCell>
                    <TableHeaderCell>Avg Cost</TableHeaderCell>
                    <TableHeaderCell>Current Price</TableHeaderCell>
                    <TableHeaderCell>24h Chg $</TableHeaderCell>
                    <TableHeaderCell>24h Chg %</TableHeaderCell>
                    <TableHeaderCell>Market Value</TableHeaderCell>
                    <TableHeaderCell>Cost Basis</TableHeaderCell>
                    <TableHeaderCell>Unrealized P&L</TableHeaderCell>
                    <TableHeaderCell>Return %</TableHeaderCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {ledger.holdings.map((holding, index) => (
                    <TableRow key={index}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div>
                            <p className="font-medium text-[var(--foreground)]">{holding.symbol}</p>
                            <p className="text-xs text-[var(--muted-foreground)]">
                              {holding.assetType === 'CASH' ? 'Cash' : getAssetDisplayName(holding.symbol, holding.assetType)}
                            </p>
                          </div>
                          <Badge tone={holding.assetType === 'CRYPTO' ? 'warning' : 'success'} className="text-xs">
                            {holding.assetType === 'CRYPTO' ? 'Crypto' : holding.assetType === 'CASH' ? 'Cash' : 'Stock'}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell>
                        {holding.quantity.toLocaleString('en-US', {
                          minimumFractionDigits: 1,
                          maximumFractionDigits: 1
                        })}
                      </TableCell>
                      <TableCell>
                        ${Math.round(holding.averageCost).toLocaleString()}
                      </TableCell>
                      <TableCell>
                        ${Math.round(holding.currentPrice).toLocaleString()}
                      </TableCell>
                      <TableCell>
                        {formatChange24h(holding.change24h * holding.quantity)}
                      </TableCell>
                      <TableCell>
                        {formatGainLossPercent(holding.changePercent24h)}
                      </TableCell>
                      <TableCell className="font-medium">
                        ${Math.round(holding.marketValue * 100).toLocaleString()}
                      </TableCell>
                      <TableCell>
                        ${Math.round(holding.costBasis * 100).toLocaleString()}
                      </TableCell>
                      <TableCell>
                        {formatGainLoss(holding.unrealizedGainLoss)}
                      </TableCell>
                      <TableCell>
                        {formatGainLossPercent(holding.unrealizedGainLossPercent)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <p className="text-sm text-[var(--muted-foreground)] text-center py-8">
              No current holdings. Add some transactions to see positions here.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Recent Transactions */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Transactions</CardTitle>
        </CardHeader>
        <CardContent>
          {ledger.recentTransactions.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHead>
                  <TableRow>
                    <TableHeaderCell>Date</TableHeaderCell>
                    <TableHeaderCell>Type</TableHeaderCell>
                    <TableHeaderCell>Asset</TableHeaderCell>
                    <TableHeaderCell>Quantity</TableHeaderCell>
                    <TableHeaderCell>Price</TableHeaderCell>
                    <TableHeaderCell>Amount</TableHeaderCell>
                    <TableHeaderCell>Fees</TableHeaderCell>
                    <TableHeaderCell>Notes</TableHeaderCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {ledger.recentTransactions.map((transaction) => (
                    <TableRow key={transaction.id}>
                      <TableCell>
                        {format(new Date(transaction.occurredAt), "MMM d, yyyy")}
                      </TableCell>
                      <TableCell>
                        <Badge
                          tone={
                            ['BUY', 'DEPOSIT', 'DIVIDEND', 'INTEREST'].includes(transaction.type) ? 'success' :
                            ['SELL', 'WITHDRAW', 'FEE'].includes(transaction.type) ? 'warning' : 'default'
                          }
                        >
                          {transaction.type}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {transaction.symbol ? (
                          <div className="flex items-center gap-1">
                            <span className="font-medium">{transaction.symbol}</span>
                            {transaction.assetType && (
                              <Badge tone={transaction.assetType === 'CRYPTO' ? 'warning' : 'success'} className="text-xs">
                                {transaction.assetType === 'CRYPTO' ? 'C' : 'S'}
                              </Badge>
                            )}
                          </div>
                        ) : (
                          <span className="text-[var(--muted-foreground)]">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {transaction.quantity ? Number(transaction.quantity).toLocaleString() : "—"}
                      </TableCell>
                      <TableCell>
                        {transaction.pricePerUnit ? `$${Number(transaction.pricePerUnit).toLocaleString()}` : "—"}
                      </TableCell>
                      <TableCell className="font-medium">
                        {formatCurrency(transaction.amount, ledger.currency)}
                      </TableCell>
                      <TableCell>
                        {transaction.fees ? formatCurrency(transaction.fees, ledger.currency) : "—"}
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-[var(--muted-foreground)]">
                          {transaction.notes || "—"}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <p className="text-sm text-[var(--muted-foreground)] text-center py-8">
              No transactions found.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}