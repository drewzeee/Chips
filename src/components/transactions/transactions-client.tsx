"use client";

import { useEffect, useMemo, useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, parseAmountToCents } from "@/lib/utils";
import { format } from "date-fns";

const transactionFormSchema = z.object({
  id: z.string().optional(),
  date: z.string(),
  description: z.string().min(1, "Description is required"),
  merchant: z.string().optional().nullable(),
  amount: z.string(),
  type: z.enum(["INCOME", "EXPENSE", "TRANSFER"]),
  accountId: z.string().min(1, "Account is required"),
  status: z.enum(["PENDING", "CLEARED", "RECONCILED"]),
  categoryId: z.string().optional(),
  memo: z.string().optional().nullable(),
  splits: z
    .array(
      z.object({
        categoryId: z.string().min(1, "Category is required"),
        amount: z.string().min(1, "Amount is required"),
      })
    )
    .optional(),
});

type TransactionFormValues = z.infer<typeof transactionFormSchema>;

const transferFormSchema = z.object({
  fromAccountId: z.string().min(1, "From account is required"),
  toAccountId: z.string().min(1, "To account is required"),
  date: z.string().min(1, "Date is required"),
  amount: z.string().min(1, "Amount is required"),
  description: z.string().min(1, "Description is required"),
  memo: z.string().optional().nullable(),
});

type TransferFormValues = z.infer<typeof transferFormSchema>;

function formatCentsForInput(cents: number, preserveSign = false) {
  const workingCents = preserveSign ? cents : Math.abs(cents);
  const isNegative = workingCents < 0;
  const absolute = Math.abs(workingCents);
  const formatted = (absolute / 100)
    .toFixed(2)
    .replace(/\.00$/, "")
    .replace(/(\.\d)0$/, "$1");
  return isNegative ? `-${formatted}` : formatted;
}

export interface TransactionCategory {
  id: string;
  name: string;
  type: "INCOME" | "EXPENSE" | "TRANSFER";
}

export interface TransactionAccount {
  id: string;
  name: string;
  currency: string;
}

export interface TransactionSplitItem {
  id: string;
  categoryId: string;
  amount: number;
  category?: {
    id: string;
    name: string;
    type: "INCOME" | "EXPENSE" | "TRANSFER";
  };
}

export interface TransactionItem {
  id: string;
  date: string;
  description: string;
  merchant: string | null;
  amount: number;
  status: "PENDING" | "CLEARED" | "RECONCILED";
  accountId: string;
  account: TransactionAccount;
  memo: string | null;
  reference?: string | null;
  importTag?: string | null;
  splits: TransactionSplitItem[];
}

type Filters = {
  accountId: string;
  categoryId: string;
  search: string;
  from: string;
  to: string;
  uncategorized: boolean;
};


interface ManualTransferCandidate {
  transaction: {
    id: string;
    date: string;
    description: string;
    amount: number;
    status: "PENDING" | "CLEARED" | "RECONCILED";
    accountId: string;
    memo: string | null;
    reference?: string | null;
  };
  account: {
    id: string;
    name: string;
    type: string;
    currency: string;
  };
  confidence: number;
}

export function TransactionsClient({
  initialTransactions,
  accounts,
  categories,
}: {
  initialTransactions: TransactionItem[];
  accounts: TransactionAccount[];
  categories: TransactionCategory[];
}) {
  const [transactions, setTransactions] = useState(initialTransactions);
  const [filters, setFilters] = useState<Filters>({
    accountId: "",
    categoryId: "",
    search: "",
    from: "",
    to: "",
    uncategorized: false,
  });
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [transferError, setTransferError] = useState<string | null>(null);
  const [transferLoading, setTransferLoading] = useState(false);
  const [isTransactionDrawerOpen, setIsTransactionDrawerOpen] = useState(false);
  const [isTransferDrawerOpen, setIsTransferDrawerOpen] = useState(false);
  const [manualTransferModal, setManualTransferModal] = useState(false);
  const [manualTransferTarget, setManualTransferTarget] = useState<TransactionItem | null>(null);
  const [manualCandidates, setManualCandidates] = useState<ManualTransferCandidate[]>([]);
  const [manualLoading, setManualLoading] = useState(false);
  const [manualError, setManualError] = useState<string | null>(null);
  const [manualSuccess, setManualSuccess] = useState<string | null>(null);
  const [linkCounterpartId, setLinkCounterpartId] = useState("");

  const currentTransaction = selectedId
    ? transactions.find((transaction) => transaction.id === selectedId) ?? null
    : null;
  const isTransferTransaction = Boolean(currentTransaction?.reference?.startsWith("transfer_"));

  const transferCounterpart = useMemo(() => {
    if (!isTransferTransaction || !currentTransaction?.reference) {
      return null;
    }

    return (
      transactions.find(
        (transaction) =>
          transaction.reference === currentTransaction.reference && transaction.id !== currentTransaction.id
      ) ?? null
    );
  }, [isTransferTransaction, currentTransaction, transactions]);

  const form = useForm<TransactionFormValues>({
    resolver: zodResolver(transactionFormSchema),
    defaultValues: {
      date: new Date().toISOString().slice(0, 10),
      description: "",
      merchant: "",
      amount: "0",
      type: "EXPENSE",
      accountId: accounts[0]?.id ?? "",
      status: "CLEARED",
      categoryId: categories.find((category) => category.type === "EXPENSE")?.id ?? "",
      memo: "",
      splits: [],
    },
  });

  const transferForm = useForm<TransferFormValues>({
    resolver: zodResolver(transferFormSchema),
    defaultValues: {
      fromAccountId: accounts[0]?.id ?? "",
      toAccountId: accounts.length > 1 ? accounts[1].id : "",
      date: new Date().toISOString().slice(0, 10),
      amount: "",
      description: "Transfer",
      memo: "",
    },
  });

  const { fields: splitFields, append: appendSplit, remove: removeSplit, replace: replaceSplits } =
    useFieldArray({ control: form.control, name: "splits" });

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams();
    if (filters.accountId) params.append("accountId", filters.accountId);
    if (filters.categoryId) params.append("categoryId", filters.categoryId);
    if (filters.search) params.append("search", filters.search);
    if (filters.from) params.append("from", filters.from);
    if (filters.to) params.append("to", filters.to);
    if (filters.uncategorized) params.append("uncategorized", "true");
    params.append("limit", "200");

    setLoading(true);
    fetch(`/api/transactions?${params.toString()}`, { signal: controller.signal })
      .then((response) => response.json())
      .then((data: TransactionItem[]) => setTransactions(data))
      .catch(() => null)
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, [filters.accountId, filters.categoryId, filters.search, filters.from, filters.to, filters.uncategorized]);

  const resetForm = () => {
    setSelectedId(null);
    setFormError(null);
    replaceSplits([]);
    setLinkCounterpartId("");
    form.reset({
      date: new Date().toISOString().slice(0, 10),
      description: "",
      merchant: "",
      amount: "0",
      type: "EXPENSE",
      accountId: accounts[0]?.id ?? "",
      status: "CLEARED",
      categoryId: categories.find((category) => category.type === "EXPENSE")?.id ?? "",
      memo: "",
      splits: [],
    });
  };

  const resetTransferForm = () => {
    transferForm.reset({
      fromAccountId: accounts[0]?.id ?? "",
      toAccountId:
        accounts.length > 1
          ? accounts.find((account) => account.id !== (accounts[0]?.id ?? ""))?.id ?? ""
          : "",
      date: new Date().toISOString().slice(0, 10),
      amount: "",
      description: "Transfer",
      memo: "",
    });
  };

  const openAddTransactionDrawer = () => {
    resetForm();
    setIsTransactionDrawerOpen(true);
  };

  const closeTransactionDrawer = () => {
    setIsTransactionDrawerOpen(false);
    resetForm();
  };

  const openTransferDrawer = () => {
    resetTransferForm();
    setIsTransferDrawerOpen(true);
  };

  const closeTransferDrawer = () => {
    setIsTransferDrawerOpen(false);
    resetTransferForm();
  };

  const closeManualTransferModal = () => {
    setManualTransferModal(false);
    setManualTransferTarget(null);
    setManualCandidates([]);
    setManualLoading(false);
    setManualError(null);
    setManualSuccess(null);
  };

  const loadManualCandidates = async (transaction: TransactionItem) => {
    setManualLoading(true);
    setManualError(null);
    try {
      const response = await fetch(`/api/transactions/${transaction.id}/transfer-candidates`);
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error ?? "Unable to fetch candidates");
      }
      const data: ManualTransferCandidate[] = await response.json();
      setManualCandidates(data);
    } catch (error) {
      setManualError(error instanceof Error ? error.message : "Unexpected error");
    } finally {
      setManualLoading(false);
    }
  };

  const openManualTransferModal = (transaction: TransactionItem) => {
    setManualTransferTarget(transaction);
    setManualTransferModal(true);
    setManualCandidates([]);
    setManualSuccess(null);
    loadManualCandidates(transaction);
  };

  const handleEdit = (transaction: TransactionItem) => {
    setSelectedId(transaction.id);
    const isTransfer = Boolean(transaction.reference?.startsWith("transfer_"));
    const isExpense = transaction.amount < 0;
    const baseAmount = formatCentsForInput(transaction.amount, isTransfer);
    const counterpart = isTransfer
      ? transactions.find(
          (candidate) =>
            candidate.reference === transaction.reference && candidate.id !== transaction.id
        ) ?? null
      : null;
    const primarySplit = transaction.splits.map((split) => ({
      categoryId: split.categoryId,
      amount: (Math.abs(split.amount) / 100).toString(),
    }));

    form.reset({
      id: transaction.id,
      date: transaction.date.slice(0, 10),
      description: transaction.description,
      merchant: transaction.merchant ?? "",
      amount: baseAmount,
      type: isTransfer ? "TRANSFER" : isExpense ? "EXPENSE" : "INCOME",
      accountId: transaction.accountId,
      status: transaction.status,
      categoryId: transaction.splits[0]?.categoryId ?? "",
      memo: transaction.memo ?? "",
      splits: primarySplit,
    });
    replaceSplits(primarySplit);
    setLinkCounterpartId(counterpart?.id ?? "");

    setIsTransactionDrawerOpen(true);
  };

  const watchType = form.watch("type");

  useEffect(() => {
    if (watchType === "TRANSFER") {
      form.setValue("categoryId", "");
      replaceSplits([]);
    } else {
      setLinkCounterpartId("");
    }
  }, [watchType, form, replaceSplits]);

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      setFormError(null);
      const rawCents = parseAmountToCents(values.amount);
      const absoluteCents = Math.abs(rawCents);
      const trimmedCounterpartId = linkCounterpartId.trim();

      const resolvedReference =
        values.type === "TRANSFER"
          ? currentTransaction?.reference ?? `transfer_manual_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
          : null;

      let signedAmount: number;

      if (values.type === "TRANSFER") {
        if (absoluteCents === 0) {
          setFormError("Transfer amount must not be zero");
          return;
        }
        const inputTrimmed = values.amount.trim();
        let sign = rawCents === 0 ? 0 : Math.sign(rawCents);

        if (inputTrimmed.startsWith("-")) {
          sign = -1;
        } else if (inputTrimmed.startsWith("+")) {
          sign = 1;
        } else if (sign === 0 && selectedId && currentTransaction) {
          sign = Math.sign(currentTransaction.amount) || -1;
        } else if (selectedId && currentTransaction && rawCents >= 0) {
          const currentSign = Math.sign(currentTransaction.amount);
          if (currentSign !== 0) {
            sign = currentSign;
          }
        }

        if (sign === 0) {
          sign = 1;
        }
        signedAmount = sign * absoluteCents;
      } else {
        signedAmount = values.type === "EXPENSE" ? -absoluteCents : absoluteCents;
      }

      let splitsPayload = values.type === "TRANSFER" ? [] : (values.splits ?? []).filter((split) => split.categoryId);
      if (values.type !== "TRANSFER" && splitsPayload.length === 0 && values.categoryId) {
        splitsPayload = [{ categoryId: values.categoryId, amount: values.amount }];
      }

      const preparedSplits = splitsPayload.map((split) => {
        const splitCents = parseAmountToCents(split.amount || "0");
        const normalizedSplit = values.type === "EXPENSE" ? -Math.abs(splitCents) : Math.abs(splitCents);
        return {
          categoryId: split.categoryId,
          amount: normalizedSplit,
        };
      });

      if (preparedSplits.length > 0) {
        const totalSplit = preparedSplits.reduce((sum, split) => sum + split.amount, 0);
        if (totalSplit !== signedAmount) {
          setFormError("Split amounts must equal the transaction amount");
          return;
        }
      }

      const payload = {
        accountId: values.accountId,
        date: values.date,
        amount: signedAmount,
        description: values.description,
        merchant: values.merchant || null,
        memo: values.memo || null,
        status: values.status,
        reference: resolvedReference,
        splits: preparedSplits,
      };

      const response = await fetch(selectedId ? `/api/transactions/${selectedId}` : "/api/transactions", {
        method: selectedId ? "PUT" : "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const json = await response.json().catch(() => null);
        throw new Error(json?.error ?? "Unable to save transaction");
      }

      const savedTransaction: TransactionItem = await response.json();

      let nextTransactions: TransactionItem[];
      if (selectedId) {
        nextTransactions = transactions.map((item) =>
          item.id === savedTransaction.id ? savedTransaction : item
        );
      } else {
        const combined = [savedTransaction, ...transactions];
        const seen = new Set<string>();
        const deduped: TransactionItem[] = [];
        for (const entry of combined) {
          if (!seen.has(entry.id)) {
            seen.add(entry.id);
            deduped.push(entry);
          }
        }
        nextTransactions = deduped.slice(0, 200);
      }

      setTransactions(nextTransactions);

      if (values.type === "TRANSFER" && trimmedCounterpartId) {
        if (trimmedCounterpartId === savedTransaction.id) {
          setFormError("Cannot link a transfer to itself");
          return;
        }

        const linkResponse = await fetch("/api/transactions/mark-transfer", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            transactionId: savedTransaction.id,
            counterpartTransactionId: trimmedCounterpartId,
          }),
        });

        if (!linkResponse.ok) {
          const json = await linkResponse.json().catch(() => null);
          setFormError(json?.error ?? "Unable to link transfer");
          return;
        }

        const linkPayload = await linkResponse.json();
        const updatedPrimary: TransactionItem | undefined = linkPayload.primary;
        const updatedCounterpart: TransactionItem | undefined = linkPayload.counterpart;

        setTransactions((prev) => {
          let updated = prev.map((item) => {
            if (updatedPrimary && item.id === updatedPrimary.id) {
              return updatedPrimary;
            }
            if (updatedCounterpart && item.id === updatedCounterpart.id) {
              return updatedCounterpart;
            }
            return item;
          });

          if (updatedCounterpart && !updated.some((item) => item.id === updatedCounterpart.id)) {
            updated = [updatedCounterpart, ...updated];
          }

          return updated.slice(0, 200);
        });
      }

      closeTransactionDrawer();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Unexpected error");
    }
  });

  const onSubmitTransfer = transferForm.handleSubmit(async (values) => {
    try {
      setTransferError(null);
      setTransferLoading(true);

      if (values.fromAccountId === values.toAccountId) {
        setTransferError("Select two different accounts");
        return;
      }

      const cents = parseAmountToCents(values.amount);
      if (cents <= 0) {
        setTransferError("Amount must be greater than zero");
        return;
      }

      const response = await fetch("/api/transactions/transfer", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fromAccountId: values.fromAccountId,
          toAccountId: values.toAccountId,
          date: values.date,
          amount: cents,
          description: values.description,
          memo: values.memo || null,
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error ?? "Unable to create transfer");
      }

      const data: { debit: TransactionItem; credit: TransactionItem } = await response.json();
      setTransactions((prev) => {
        const combined = [data.debit, data.credit, ...prev];
        const seen = new Set<string>();
        const deduped: TransactionItem[] = [];
        for (const item of combined) {
          if (!seen.has(item.id)) {
            seen.add(item.id);
            deduped.push(item);
          }
        }
        return deduped.slice(0, 200);
      });
      closeTransferDrawer();
    } catch (error) {
      setTransferError(error instanceof Error ? error.message : "Unexpected error");
    } finally {
      setTransferLoading(false);
    }
  });

  const handleManualTransfer = async (counterpartId: string) => {
    if (!manualTransferTarget) return;
    try {
      setManualError(null);
      setManualSuccess(null);
      setManualLoading(true);
      const response = await fetch("/api/transactions/mark-transfer", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          transactionId: manualTransferTarget.id,
          counterpartTransactionId: counterpartId,
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error ?? "Unable to mark transfer");
      }

      const payload = await response.json();
      const updatedPrimary: TransactionItem | undefined = payload.primary;
      const updatedCounterpart: TransactionItem | undefined = payload.counterpart;

      setTransactions((prev) => {
        const next = prev.map((item) => {
          if (updatedPrimary && item.id === updatedPrimary.id) {
            return { ...item, ...updatedPrimary };
          }
          if (updatedCounterpart && item.id === updatedCounterpart.id) {
            return { ...item, ...updatedCounterpart };
          }
          return item;
        });

        if (updatedCounterpart && !next.some((item) => item.id === updatedCounterpart.id)) {
          return [updatedCounterpart, ...next].slice(0, 200);
        }
        return next;
      });

      setManualSuccess("Marked as transfer");
      setTimeout(() => {
        closeManualTransferModal();
      }, 1200);
    } catch (error) {
      setManualError(error instanceof Error ? error.message : "Unexpected error");
    } finally {
      setManualLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Delete this transaction?")) return;
    try {
      const response = await fetch(`/api/transactions/${id}`, { method: "DELETE" });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error ?? "Unable to delete transaction");
      }
      setTransactions((prev) => prev.filter((transaction) => transaction.id !== id));
      if (selectedId === id) resetForm();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Unexpected error");
    }
  };

  const categoryOptions = useMemo(() => {
    return categories.map((category) => ({
      id: category.id,
      label: category.name,
      type: category.type,
    }));
  }, [categories]);

  const filteredTotals = useMemo(() => {
    let income = 0;
    let expenses = 0;
    let total = 0;
    for (const transaction of transactions) {
      total += transaction.amount;
      const isTransfer = transaction.reference?.startsWith("transfer_") ?? false;
      if (isTransfer) continue;
      if (transaction.amount >= 0) {
        income += transaction.amount;
      } else {
        expenses += transaction.amount;
      }
    }
    return {
      count: transactions.length,
      total,
      income,
      expenses,
    };
  }, [transactions]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-6">
            <div className="space-y-2">
              <Label htmlFor="filterAccount">Account</Label>
              <Select
                id="filterAccount"
                value={filters.accountId}
                onChange={(event) => setFilters((prev) => ({ ...prev, accountId: event.target.value }))}
              >
                <option value="">All</option>
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="filterCategory">Category</Label>
              <Select
                id="filterCategory"
                value={filters.categoryId}
                onChange={(event) => setFilters((prev) => ({ ...prev, categoryId: event.target.value }))}
              >
                <option value="">All</option>
                {categoryOptions.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.label}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="search">Search</Label>
              <Input
                id="search"
                value={filters.search}
                placeholder="Merchant or description"
                onChange={(event) => setFilters((prev) => ({ ...prev, search: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="from">From</Label>
              <Input
                id="from"
                type="date"
                value={filters.from}
                onChange={(event) => setFilters((prev) => ({ ...prev, from: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="to">To</Label>
              <Input
                id="to"
                type="date"
                value={filters.to}
                onChange={(event) => setFilters((prev) => ({ ...prev, to: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="uncategorized">Filters</Label>
              <div className="flex items-center space-x-2">
                <input
                  id="uncategorized"
                  type="checkbox"
                  checked={filters.uncategorized}
                  onChange={(event) => setFilters((prev) => ({ ...prev, uncategorized: event.target.checked }))}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <Label htmlFor="uncategorized" className="text-sm font-normal">
                  Uncategorized only
                </Label>
              </div>
            </div>
          </div>

          <div className="mt-6 grid gap-3 rounded-lg border border-[var(--border)] bg-[color:color-mix(in_srgb,var(--card)_92%,transparent)] p-4 text-sm text-[var(--foreground)] sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <p className="text-xs uppercase tracking-wide text-[var(--muted-foreground)]">Visible transactions</p>
              <p className="mt-1 text-lg font-semibold">{filteredTotals.count}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-[var(--muted-foreground)]">Net total</p>
              <p className="mt-1 text-lg font-semibold">{formatCurrency(filteredTotals.total)}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-[var(--muted-foreground)]">Income (visible)</p>
              <p className="mt-1 text-lg font-semibold">{formatCurrency(filteredTotals.income)}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-[var(--muted-foreground)]">Expenses (visible)</p>
              <p className="mt-1 text-lg font-semibold">{formatCurrency(Math.abs(filteredTotals.expenses))}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle>Transactions</CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-[var(--muted-foreground)]">
              {loading ? "Loading..." : `${transactions.length} results`}
            </span>
            <Button size="sm" onClick={openAddTransactionDrawer}>
              Add transaction
            </Button>
            <Button size="sm" variant="secondary" onClick={openTransferDrawer}>
              New transfer
            </Button>
          </div>
        </CardHeader>
        <CardContent className="max-h-[520px] overflow-y-auto">
          <Table>
            <TableHead>
              <TableRow>
                <TableHeaderCell>Date</TableHeaderCell>
                <TableHeaderCell>Description</TableHeaderCell>
                <TableHeaderCell>Account</TableHeaderCell>
                <TableHeaderCell>Category</TableHeaderCell>
                <TableHeaderCell className="text-right">Amount</TableHeaderCell>
                <TableHeaderCell></TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {transactions.map((transaction) => {
                const isUncategorized = transaction.splits.length === 0;
                const categoriesLabel = isUncategorized
                  ? "Uncategorized"
                  : transaction.splits
                      .map((split) => `${split.category?.name ?? "Uncategorized"}`)
                      .join(", ");
                return (
                    <TableRow key={transaction.id}>
                      <TableCell>{format(new Date(transaction.date), "MMM d, yyyy")}</TableCell>
                      <TableCell>
                        <div className="font-medium text-[var(--foreground)]">{transaction.description}</div>
                      </TableCell>
                      <TableCell>{transaction.account.name}</TableCell>
                    <TableCell
                      className={
                        isUncategorized
                          ? "font-medium text-red-600 dark:text-rose-300"
                          : ""
                      }
                    >
                      {categoriesLabel}
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      {formatCurrency(transaction.amount, transaction.account.currency)}
                    </TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button variant="ghost" size="sm" onClick={() => handleEdit(transaction)}>
                        Edit
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-red-600 hover:text-red-700 dark:text-rose-300 dark:hover:text-rose-200"
                        onClick={() => handleDelete(transaction.id)}
                      >
                        Delete
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {manualTransferModal && manualTransferTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-2xl rounded-2xl bg-[var(--card)] p-6 shadow-xl">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-lg font-semibold text-[var(--foreground)]">Convert to transfer</h2>
                <p className="text-sm text-[var(--muted-foreground)]">
                  Select the matching transaction to pair with
                  {" "}
                  <span className="font-medium text-[var(--foreground)]">{manualTransferTarget.description}</span>.
                </p>
              </div>
              <Button variant="ghost" size="sm" onClick={closeManualTransferModal}>
                Close
              </Button>
            </div>

            <div className="mt-4 rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm">
              <div className="font-medium text-gray-900">Selected transaction</div>
              <div className="mt-1 text-gray-600">
                {format(new Date(manualTransferTarget.date), "MMM d, yyyy")} · {manualTransferTarget.account.name}
              </div>
              <div className="mt-1 text-gray-800">{manualTransferTarget.description}</div>
              <div className="mt-1 font-semibold">
                {formatCurrency(manualTransferTarget.amount, manualTransferTarget.account.currency)}
              </div>
            </div>

            <div className="mt-4">
              <h3 className="text-sm font-medium text-gray-900">Suggested matches</h3>
              <p className="text-xs text-gray-500">
                We look for opposite-sign transactions within a few days. If you don’t see the right one,
                use the transfer form to create a manual entry.
              </p>
            </div>

            <div className="mt-3 max-h-64 overflow-y-auto rounded-lg border border-gray-200">
              {manualLoading && (
                <div className="p-4 text-sm text-gray-500">Searching for matches…</div>
              )}
              {!manualLoading && manualCandidates.length === 0 && (
                <div className="p-4 text-sm text-gray-500">
                  No obvious matches found. You can still create a transfer using the “New transfer” action above.
                </div>
              )}
              {manualCandidates.map((candidate) => (
                <div
                  key={candidate.transaction.id}
                  className="flex items-center justify-between gap-3 border-b border-gray-200 p-4 last:border-b-0"
                >
                  <div>
                    <div className="font-medium text-gray-900">
                      {format(new Date(candidate.transaction.date), "MMM d, yyyy")} · {candidate.account.name}
                    </div>
                    <div className="text-sm text-gray-700">{candidate.transaction.description}</div>
                    <div className="text-xs text-gray-500">Confidence score: {candidate.confidence}/5</div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold text-gray-900">
                      {formatCurrency(candidate.transaction.amount, candidate.account.currency)}
                    </div>
                    <Button
                      size="sm"
                      className="mt-2"
                      onClick={() => handleManualTransfer(candidate.transaction.id)}
                      disabled={manualLoading}
                    >
                      Use match
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            {manualError && <p className="mt-3 text-sm text-red-600">{manualError}</p>}
            {manualSuccess && <p className="mt-3 text-sm text-green-600">{manualSuccess}</p>}
          </div>
        </div>
      )}

      {isTransactionDrawerOpen && (
        <div className="fixed inset-0 z-40 flex justify-end bg-black/40">
          <div className="h-full w-full max-w-md overflow-y-auto border border-[var(--border)]/60 bg-[color:color-mix(in_srgb,var(--card)_92%,var(--background)_8%)] p-6 shadow-[0_24px_48px_-28px_rgba(15,23,42,0.55)] backdrop-blur">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-[var(--foreground)]">
                  {selectedId ? "Edit transaction" : "Add transaction"}
                </h2>
                <p className="text-sm text-[var(--muted-foreground)]">
                  {selectedId ? "Adjust the details below and save." : "Record a new income or expense."}
                </p>
              </div>
              <Button variant="ghost" size="sm" onClick={closeTransactionDrawer}>
                Close
              </Button>
            </div>

            {currentTransaction && (
              <div className="mt-4 space-y-3 text-xs text-[var(--muted-foreground)]">
                <div className="rounded-lg border border-dashed border-[var(--border)]/70 bg-[color:color-mix(in_srgb,var(--card)_85%,transparent)] p-3">
                  <span className="font-medium uppercase tracking-wide">Transaction ID</span>
                  <code className="mt-1 block overflow-hidden text-ellipsis whitespace-nowrap rounded bg-[var(--muted)] px-2 py-1 font-mono text-sm text-[var(--foreground)]">
                    {currentTransaction.id}
                  </code>
                </div>
                {currentTransaction.importTag && (
                  <div className="rounded-lg border border-dashed border-[var(--border)]/70 bg-[color:color-mix(in_srgb,var(--card)_85%,transparent)] p-3">
                    <span className="font-medium uppercase tracking-wide">Import tag</span>
                    <code className="mt-1 block overflow-hidden text-ellipsis whitespace-nowrap rounded bg-[var(--muted)] px-2 py-1 font-mono text-sm text-[var(--foreground)]">
                      {currentTransaction.importTag}
                    </code>
                  </div>
                )}
              </div>
            )}

            {isTransferTransaction && (
              <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
                <div className="flex items-center gap-2">
                  <Badge tone="success">Transfer</Badge>
                  <span className="font-semibold">Linked transaction</span>
                </div>
                <p className="mt-2 text-emerald-800">
                  This entry is part of a matched transfer between accounts. Updates here keep both sides in sync.
                </p>
                {transferCounterpart ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="mt-3 text-emerald-700 hover:text-emerald-900"
                    onClick={() => handleEdit(transferCounterpart)}
                  >
                    Open linked transaction
                  </Button>
                ) : (
                  <p className="mt-3 text-xs text-emerald-700">
                    The linked transfer falls outside the current list but remains connected for reporting.
                  </p>
                )}
              </div>
            )}

            <form className="mt-6 space-y-4" onSubmit={onSubmit}>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="drawer-date">Date</Label>
                  <Input id="drawer-date" type="date" {...form.register("date")} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="drawer-account">Account</Label>
                  <Select id="drawer-account" {...form.register("accountId")}>
                    {accounts.map((account) => (
                      <option key={account.id} value={account.id}>
                        {account.name}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="drawer-description">Description</Label>
                <Input id="drawer-description" {...form.register("description")} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="drawer-merchant">Merchant</Label>
                <Input id="drawer-merchant" placeholder="Optional" {...form.register("merchant")} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="drawer-memo">Notes</Label>
                <Textarea id="drawer-memo" rows={3} placeholder="Optional" {...form.register("memo")} />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="drawer-amount">Amount</Label>
                  <Input id="drawer-amount" {...form.register("amount")} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="drawer-type">Type</Label>
                  <Select id="drawer-type" {...form.register("type")}>
                    <option value="EXPENSE">Expense</option>
                    <option value="INCOME">Income</option>
                    <option value="TRANSFER">Transfer</option>
                  </Select>
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="drawer-status">Status</Label>
                  <Select id="drawer-status" {...form.register("status")}>
                    <option value="PENDING">Pending</option>
                    <option value="CLEARED">Cleared</option>
                    <option value="RECONCILED">Reconciled</option>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="drawer-category">Primary category</Label>
                  <Select id="drawer-category" disabled={watchType === "TRANSFER"} {...form.register("categoryId")}>
                    <option value="">Uncategorized</option>
                    {categoryOptions.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.label}
                      </option>
                    ))}
                  </Select>
                  {watchType === "TRANSFER" && (
                    <p className="text-xs text-[var(--muted-foreground)]">Transfers do not use categories.</p>
                  )}
                </div>
              </div>

              {watchType === "TRANSFER" && (
                <div className="space-y-2">
                  <Label htmlFor="drawer-transfer-link">Linked transaction ID</Label>
                  <Input
                    id="drawer-transfer-link"
                    value={linkCounterpartId}
                    onChange={(event) => setLinkCounterpartId(event.target.value)}
                    placeholder="Optional — enter the matching transaction ID"
                  />
                  <p className="text-xs text-[var(--muted-foreground)]">
                    Linking two transactions treats both sides as a single transfer so they are excluded from income and
                    expense totals.
                  </p>
                </div>
              )}

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Splits</Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={watchType === "TRANSFER"}
                    onClick={() => appendSplit({ categoryId: "", amount: "" })}
                  >
                    Add split
                  </Button>
                </div>
                {splitFields.length === 0 && (
                  <p className="text-sm text-[var(--muted-foreground)]">
                    Use splits to divide the transaction across multiple categories.
                  </p>
                )}
                {splitFields.map((field, index) => (
                  <div key={field.id} className="grid gap-2 sm:grid-cols-2">
                    <Select
                      disabled={watchType === "TRANSFER"}
                      {...form.register(`splits.${index}.categoryId` as const)}
                    >
                      <option value="">Select category</option>
                      {categoryOptions.map((option) => (
                        <option key={option.id} value={option.id}>
                          {option.label}
                        </option>
                      ))}
                    </Select>
                    <div className="flex items-center gap-2">
                      <Input
                        disabled={watchType === "TRANSFER"}
                        {...form.register(`splits.${index}.amount` as const)}
                        placeholder="Amount"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={watchType === "TRANSFER"}
                        onClick={() => removeSplit(index)}
                      >
                        Remove
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              {formError && <p className="text-sm text-red-600">{formError}</p>}

              <div className="flex items-center gap-2">
                <Button type="submit">{selectedId ? "Save changes" : "Add transaction"}</Button>
                <Button type="button" variant="secondary" onClick={resetForm}>
                  Reset form
                </Button>
              </div>

              {currentTransaction && !currentTransaction.reference && (
                <div className="rounded-lg border border-dashed border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
                  <p className="font-medium">Need to treat this as a transfer?</p>
                  <p className="mt-1 text-blue-700">
                    We can search for a matching counterpart in other accounts and link them instantly.
                  </p>
                  <Button
                    type="button"
                    variant="ghost"
                    className="mt-3 text-blue-700 hover:text-blue-900"
                    onClick={() => openManualTransferModal(currentTransaction)}
                  >
                    Find matching transfer
                  </Button>
                </div>
              )}
            </form>
          </div>
        </div>
      )}

      {isTransferDrawerOpen && (
        <div className="fixed inset-0 z-40 flex justify-end bg-black/40">
          <div className="h-full w-full max-w-md overflow-y-auto bg-[var(--card)] p-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-[var(--foreground)]">Create transfer</h2>
                <p className="text-sm text-[var(--muted-foreground)]">Move funds between accounts without affecting budgets.</p>
              </div>
              <Button variant="ghost" size="sm" onClick={closeTransferDrawer}>
                Close
              </Button>
            </div>

            <form className="mt-6 space-y-4" onSubmit={onSubmitTransfer}>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="drawer-transfer-from">From account</Label>
                  <Select id="drawer-transfer-from" {...transferForm.register("fromAccountId")}>
                    <option value="">Select account</option>
                    {accounts.map((account) => (
                      <option key={`transfer-from-${account.id}`} value={account.id}>
                        {account.name}
                      </option>
                    ))}
                  </Select>
                  {transferForm.formState.errors.fromAccountId && (
                    <p className="text-sm text-red-600">
                      {transferForm.formState.errors.fromAccountId.message}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="drawer-transfer-to">To account</Label>
                  <Select id="drawer-transfer-to" {...transferForm.register("toAccountId")}>
                    <option value="">Select account</option>
                    {accounts.map((account) => (
                      <option key={`transfer-to-${account.id}`} value={account.id}>
                        {account.name}
                      </option>
                    ))}
                  </Select>
                  {transferForm.formState.errors.toAccountId && (
                    <p className="text-sm text-red-600">
                      {transferForm.formState.errors.toAccountId.message}
                    </p>
                  )}
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="drawer-transfer-date">Date</Label>
                  <Input id="drawer-transfer-date" type="date" {...transferForm.register("date")} />
                  {transferForm.formState.errors.date && (
                    <p className="text-sm text-red-600">{transferForm.formState.errors.date.message}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="drawer-transfer-amount">Amount</Label>
                  <Input id="drawer-transfer-amount" placeholder="0.00" {...transferForm.register("amount")} />
                  {transferForm.formState.errors.amount && (
                    <p className="text-sm text-red-600">{transferForm.formState.errors.amount.message}</p>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="drawer-transfer-description">Description</Label>
                <Input id="drawer-transfer-description" {...transferForm.register("description")} />
                {transferForm.formState.errors.description && (
                  <p className="text-sm text-red-600">{transferForm.formState.errors.description.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="drawer-transfer-memo">Notes</Label>
                <Textarea
                  id="drawer-transfer-memo"
                  rows={3}
                  placeholder="Optional"
                  {...transferForm.register("memo")}
                />
              </div>

              {transferError && <p className="text-sm text-red-600">{transferError}</p>}

              <div className="flex items-center gap-2">
                <Button type="submit" disabled={transferLoading}>
                  {transferLoading ? "Creating transfer..." : "Create transfer"}
                </Button>
                <Button type="button" variant="secondary" disabled={transferLoading} onClick={resetTransferForm}>
                  Reset
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
