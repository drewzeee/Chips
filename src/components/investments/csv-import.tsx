"use client";

import * as Papa from "papaparse";
import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from "@/components/ui/table";
import { formatCurrency } from "@/lib/utils";

interface CSVTransaction {
  timestamp?: string;
  date: string;
  transactionType: string;
  coinIn?: string;
  coinsIn?: string;
  coinOut?: string;
  coinsOut?: string;
  usdValue: string;
  gasTxFee?: string;
  gasCoin?: string;
  gasUsd?: string;
  notes?: string;
  costBasis?: string;
}

interface ParsedTransaction {
  type: string;
  symbol: string | null;
  quantity: string | null;
  amount: number;
  date: string;
  originalData: CSVTransaction;
}

interface ImportPreview {
  total: number;
  duplicates: number;
  importable: number;
  preview: Array<{
    type: string;
    symbol: string | null;
    quantity: string | null;
    amount: number;
    date: string;
  }>;
}

type Step = 1 | 2 | 3;

interface CSVImportProps {
  investmentAccountId: string;
  onImportComplete: () => void;
}

export function CSVImport({ investmentAccountId, onImportComplete }: CSVImportProps) {
  const [step, setStep] = useState<Step>(1);
  const [fileName, setFileName] = useState<string>("");
  const [, setRawRows] = useState<Record<string, string>[]>([]);
  const [parsedTransactions, setParsedTransactions] = useState<ParsedTransaction[]>([]);
  const [previewStats, setPreviewStats] = useState<ImportPreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setError(null);
    setSuccessMessage(null);
    setFileName(file.name);

    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const data = results.data.filter((row) =>
          Object.values(row).some((value) => value && typeof value === "string" && value.trim() !== "")
        );
        setRawRows(data);
        parseTransactions(data);
        setStep(2);
      },
      error: (papError) => {
        setError(`Failed to parse CSV: ${papError.message}`);
      },
    });
  };

  const parseTransactions = (rows: Record<string, string>[]) => {
    const transactions: ParsedTransaction[] = [];

    for (const row of rows) {
      // Skip empty rows
      if (!row.Date || !row["Transaction Type"] || !row["USD VALUE"]) {
        continue;
      }

      const transaction: CSVTransaction = {
        timestamp: row.Timestamp,
        date: row.Date,
        transactionType: row["Transaction Type"],
        coinIn: row["Coin In"],
        coinsIn: row["# Coins In"],
        coinOut: row["Coin Out"],
        coinsOut: row["# Coins Out"],
        usdValue: row["USD VALUE"],
        gasTxFee: row["Gas/Tx Fee"],
        gasCoin: row["Gas Coin"],
        gasUsd: row["GAS USD$"],
        notes: row.NOTES,
        costBasis: row["COST BASIS"],
      };

      // Parse amount - remove $ and commas
      const amountStr = transaction.usdValue.replace(/[$,"]/g, "").trim();
      const amount = parseFloat(amountStr);
      if (isNaN(amount)) continue;

      if (transaction.transactionType.toUpperCase() === "TRADE" &&
          transaction.coinIn && transaction.coinsIn &&
          transaction.coinOut && transaction.coinsOut) {
        // For trades, create two transactions: SELL and BUY

        // SELL transaction (coin going out)
        transactions.push({
          type: "SELL",
          symbol: transaction.coinOut,
          quantity: transaction.coinsOut,
          amount: Math.round(amount * 100), // Convert to cents
          date: transaction.date,
          originalData: transaction,
        });

        // BUY transaction (coin coming in)
        transactions.push({
          type: "BUY",
          symbol: transaction.coinIn,
          quantity: transaction.coinsIn,
          amount: Math.round(amount * 100), // Convert to cents
          date: transaction.date,
          originalData: transaction,
        });
      } else {
        // Handle non-trade transactions
        let symbol: string | null = null;
        let quantity: string | null = null;

        if (transaction.coinIn && transaction.coinsIn) {
          symbol = transaction.coinIn;
          quantity = transaction.coinsIn;
        } else if (transaction.coinOut && transaction.coinsOut) {
          symbol = transaction.coinOut;
          quantity = transaction.coinsOut;
        }

        // Map transaction type
        let type = "ADJUSTMENT";
        switch (transaction.transactionType.toUpperCase()) {
          case "DEPOSIT":
            type = "DEPOSIT";
            break;
          case "INTEREST":
            type = "INTEREST";
            break;
          case "RECONCILE":
            type = "ADJUSTMENT";
            break;
        }

        transactions.push({
          type,
          symbol,
          quantity,
          amount: Math.round(amount * 100), // Convert to cents
          date: transaction.date,
          originalData: transaction,
        });
      }
    }

    setParsedTransactions(transactions);
  };

  const runPreview = async () => {
    if (parsedTransactions.length === 0) {
      setError("No valid transactions found in CSV");
      return;
    }

    setLoading(true);
    setError(null);
    setPreviewStats(null);

    try {
      const response = await fetch(`/api/investments/accounts/${investmentAccountId}/import`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transactions: parsedTransactions.map(tx => ({
            timestamp: tx.originalData.timestamp || "",
            date: tx.date,
            transactionType: tx.originalData.transactionType,
            coinIn: tx.originalData.coinIn || "",
            coinsIn: tx.originalData.coinsIn || "",
            coinOut: tx.originalData.coinOut || "",
            coinsOut: tx.originalData.coinsOut || "",
            usdValue: tx.originalData.usdValue,
            gasTxFee: tx.originalData.gasTxFee || "",
            gasCoin: tx.originalData.gasCoin || "",
            gasUsd: tx.originalData.gasUsd || "",
            notes: tx.originalData.notes || "",
            costBasis: tx.originalData.costBasis || "",
          })),
          dryRun: true,
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error ?? "Unable to preview import");
      }

      const result = await response.json();
      setPreviewStats(result);
      setStep(3);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected error");
    } finally {
      setLoading(false);
    }
  };

  const commitImport = async () => {
    if (parsedTransactions.length === 0) {
      setError("Nothing to import. Go back and select a file.");
      return;
    }

    setLoading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const response = await fetch(`/api/investments/accounts/${investmentAccountId}/import`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transactions: parsedTransactions.map(tx => ({
            timestamp: tx.originalData.timestamp || "",
            date: tx.date,
            transactionType: tx.originalData.transactionType,
            coinIn: tx.originalData.coinIn || "",
            coinsIn: tx.originalData.coinsIn || "",
            coinOut: tx.originalData.coinOut || "",
            coinsOut: tx.originalData.coinsOut || "",
            usdValue: tx.originalData.usdValue,
            gasTxFee: tx.originalData.gasTxFee || "",
            gasCoin: tx.originalData.gasCoin || "",
            gasUsd: tx.originalData.gasUsd || "",
            notes: tx.originalData.notes || "",
            costBasis: tx.originalData.costBasis || "",
          })),
          dryRun: false,
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error ?? "Import failed");
      }

      const result = await response.json();
      setSuccessMessage(
        `Imported ${result.imported} transactions. ${result.duplicates} duplicates skipped.`
      );

      // Reset form
      setStep(1);
      setParsedTransactions([]);
      setPreviewStats(null);
      setFileName("");
      setRawRows([]);

      // Refresh parent component
      onImportComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected error");
    } finally {
      setLoading(false);
    }
  };

  const samplePreview = useMemo(() => parsedTransactions.slice(0, 5), [parsedTransactions]);

  const currentStepTitle = {
    1: "Upload CSV",
    2: "Preview Transactions",
    3: "Import Summary",
  }[step];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Import CSV Transactions - {currentStepTitle}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {step === 1 && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="csvFile">CSV file</Label>
              <Input id="csvFile" type="file" accept=".csv" onChange={handleFileChange} />
              {fileName && <p className="text-sm text-gray-500">Selected: {fileName}</p>}
            </div>
            <div className="space-y-2">
              <p className="text-sm text-gray-600">
                Expected CSV format: Timestamp, Date, Transaction Type, Coin In, # Coins In,
                Coin Out, # Coins Out, USD VALUE, Gas/Tx Fee, Gas Coin, GAS USD$, NOTES, COST BASIS
              </p>
              <p className="text-xs text-gray-500">
                Supported transaction types: DEPOSIT, TRADE, INTEREST, RECONCILE
              </p>
              <p className="text-xs text-amber-600">
                Note: TRADE transactions will be split into separate SELL and BUY transactions
                to properly track asset exchanges (e.g., AVAX → USDC becomes SELL AVAX + BUY USDC)
              </p>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6">
            <div>
              <p className="text-lg font-semibold">Parsed {parsedTransactions.length} transactions</p>
              <p className="text-sm text-gray-600">
                Review the first few transactions to ensure they look correct
              </p>
            </div>

            <div className="space-y-2">
              <Label>Sample transactions</Label>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableHeaderCell>Date</TableHeaderCell>
                    <TableHeaderCell>Type</TableHeaderCell>
                    <TableHeaderCell>Symbol</TableHeaderCell>
                    <TableHeaderCell>Quantity</TableHeaderCell>
                    <TableHeaderCell className="text-right">Amount</TableHeaderCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {samplePreview.map((tx, index) => (
                    <TableRow key={`sample-${index}`}>
                      <TableCell>{tx.date}</TableCell>
                      <TableCell>{tx.type}</TableCell>
                      <TableCell>{tx.symbol || "—"}</TableCell>
                      <TableCell>{tx.quantity || "—"}</TableCell>
                      <TableCell className="text-right font-semibold">
                        {formatCurrency(tx.amount)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="flex items-center justify-between">
              <Button variant="secondary" onClick={() => setStep(1)}>
                Back
              </Button>
              <Button onClick={runPreview} disabled={loading}>
                {loading ? "Checking..." : "Run preview"}
              </Button>
            </div>
          </div>
        )}

        {step === 3 && previewStats && (
          <div className="space-y-6">
            <div>
              <p className="text-lg font-semibold">Import Summary</p>
              <ul className="mt-2 space-y-1 text-sm text-gray-600">
                <li>Total transactions: {previewStats.total}</li>
                <li>Potential duplicates: {previewStats.duplicates}</li>
                <li>Ready to import: {previewStats.importable}</li>
              </ul>
            </div>

            {previewStats.preview.length > 0 && (
              <div className="space-y-2">
                <Label>Preview of transactions to import</Label>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableHeaderCell>Date</TableHeaderCell>
                      <TableHeaderCell>Type</TableHeaderCell>
                      <TableHeaderCell>Symbol</TableHeaderCell>
                      <TableHeaderCell>Quantity</TableHeaderCell>
                      <TableHeaderCell className="text-right">Amount</TableHeaderCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {previewStats.preview.map((tx, index) => (
                      <TableRow key={`preview-${index}`}>
                        <TableCell>{tx.date}</TableCell>
                        <TableCell>{tx.type}</TableCell>
                        <TableCell>{tx.symbol || "—"}</TableCell>
                        <TableCell>{tx.quantity || "—"}</TableCell>
                        <TableCell className="text-right font-semibold">
                          {formatCurrency(tx.amount)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            <div className="flex items-center justify-between">
              <Button variant="secondary" onClick={() => setStep(2)}>
                Back
              </Button>
              <Button onClick={commitImport} disabled={loading || previewStats.importable === 0}>
                {loading ? "Importing..." : `Import ${previewStats.importable} transactions`}
              </Button>
            </div>
          </div>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}
        {successMessage && (
          <div className="space-y-2 text-sm text-green-600">
            <p>{successMessage}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}