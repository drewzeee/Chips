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
  type: z.enum(["INCOME", "EXPENSE"]),
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

export interface TransactionCategory {
  id: string;
  name: string;
  parentId: string | null;
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
  splits: TransactionSplitItem[];
}

type Filters = {
  accountId: string;
  status: string;
  categoryId: string;
  search: string;
  from: string;
  to: string;
};

const statusTone: Record<TransactionItem["status"], "default" | "success" | "warning"> = {
  CLEARED: "success",
  PENDING: "warning",
  RECONCILED: "default",
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
    status: "",
    categoryId: "",
    search: "",
    from: "",
    to: "",
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

  const currentTransaction = selectedId
    ? transactions.find((transaction) => transaction.id === selectedId) ?? null
    : null;

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
    if (filters.status) params.append("status", filters.status);
    if (filters.categoryId) params.append("categoryId", filters.categoryId);
    if (filters.search) params.append("search", filters.search);
    if (filters.from) params.append("from", filters.from);
    if (filters.to) params.append("to", filters.to);
    params.append("limit", "200");

    setLoading(true);
    fetch(`/api/transactions?${params.toString()}`, { signal: controller.signal })
      .then((response) => response.json())
      .then((data: TransactionItem[]) => setTransactions(data))
      .catch(() => null)
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, [filters.accountId, filters.status, filters.categoryId, filters.search, filters.from, filters.to]);

  const resetForm = () => {
    setSelectedId(null);
    setFormError(null);
    replaceSplits([]);
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
    const isExpense = transaction.amount < 0;
    const baseAmount = Math.abs(transaction.amount) / 100;
    const primarySplit = transaction.splits.map((split) => ({
      categoryId: split.categoryId,
      amount: (Math.abs(split.amount) / 100).toString(),
    }));

    form.reset({
      id: transaction.id,
      date: transaction.date.slice(0, 10),
      description: transaction.description,
      merchant: transaction.merchant ?? "",
      amount: baseAmount.toString(),
      type: isExpense ? "EXPENSE" : "INCOME",
      accountId: transaction.accountId,
      status: transaction.status,
      categoryId: transaction.splits[0]?.categoryId ?? "",
      memo: transaction.memo ?? "",
      splits: primarySplit,
    });

    setIsTransactionDrawerOpen(true);
  };

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      setFormError(null);
      const amountCents = parseAmountToCents(values.amount);
      const signedAmount = values.type === "EXPENSE" ? -amountCents : amountCents;

      let splitsPayload = (values.splits ?? []).filter((split) => split.categoryId);
      if (splitsPayload.length === 0 && values.categoryId) {
        splitsPayload = [{ categoryId: values.categoryId, amount: values.amount }];
      }

      const preparedSplits = splitsPayload.map((split) => ({
        categoryId: split.categoryId,
        amount:
          (values.type === "EXPENSE" ? -1 : 1) * parseAmountToCents(split.amount || "0"),
      }));

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

      const transaction: TransactionItem = await response.json();
      setTransactions((prev) => {
        if (selectedId) {
          return prev.map((item) => (item.id === transaction.id ? transaction : item));
        }
        return [transaction, ...prev].slice(0, 200);
      });
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
      label: category.parentId
        ? `${categories.find((item) => item.id === category.parentId)?.name ?? ""} › ${category.name}`
        : category.name,
      type: category.type,
    }));
  }, [categories]);

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
              <Label htmlFor="filterStatus">Status</Label>
              <Select
                id="filterStatus"
                value={filters.status}
                onChange={(event) => setFilters((prev) => ({ ...prev, status: event.target.value }))}
              >
                <option value="">All</option>
                <option value="PENDING">Pending</option>
                <option value="CLEARED">Cleared</option>
                <option value="RECONCILED">Reconciled</option>
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
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle>Transactions</CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-gray-500">
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
                <TableHeaderCell>Status</TableHeaderCell>
                <TableHeaderCell className="text-right">Amount</TableHeaderCell>
                <TableHeaderCell></TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {transactions.map((transaction) => {
                const categoriesLabel =
                  transaction.splits.length === 0
                    ? "Uncategorized"
                    : transaction.splits
                        .map((split) => `${split.category?.name ?? "Uncategorized"}`)
                        .join(", ");
                return (
                    <TableRow key={transaction.id}>
                      <TableCell>{format(new Date(transaction.date), "MMM d, yyyy")}</TableCell>
                      <TableCell>
                        <div className="font-medium text-gray-800">{transaction.description}</div>
                      </TableCell>
                      <TableCell>{transaction.account.name}</TableCell>
                    <TableCell>{categoriesLabel}</TableCell>
                    <TableCell>
                      <Badge tone={statusTone[transaction.status]}>{transaction.status}</Badge>
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
                        className="text-red-600 hover:text-red-700"
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
          <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Convert to transfer</h2>
                <p className="text-sm text-gray-500">
                  Select the matching transaction to pair with
                  {" "}
                  <span className="font-medium text-gray-900">{manualTransferTarget.description}</span>.
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
          <div className="h-full w-full max-w-md overflow-y-auto bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  {selectedId ? "Edit transaction" : "Add transaction"}
                </h2>
                <p className="text-sm text-gray-500">
                  {selectedId ? "Adjust the details below and save." : "Record a new income or expense."}
                </p>
              </div>
              <Button variant="ghost" size="sm" onClick={closeTransactionDrawer}>
                Close
              </Button>
            </div>

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
                  <Select id="drawer-category" {...form.register("categoryId")}>
                    <option value="">Uncategorized</option>
                    {categoryOptions.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.label}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Splits</Label>
                  <Button type="button" variant="ghost" size="sm" onClick={() => appendSplit({ categoryId: "", amount: "" })}>
                    Add split
                  </Button>
                </div>
                {splitFields.length === 0 && (
                  <p className="text-sm text-gray-500">
                    Use splits to divide the transaction across multiple categories.
                  </p>
                )}
                {splitFields.map((field, index) => (
                  <div key={field.id} className="grid gap-2 sm:grid-cols-2">
                    <Select {...form.register(`splits.${index}.categoryId` as const)}>
                      <option value="">Select category</option>
                      {categoryOptions.map((option) => (
                        <option key={option.id} value={option.id}>
                          {option.label}
                        </option>
                      ))}
                    </Select>
                    <div className="flex items-center gap-2">
                      <Input {...form.register(`splits.${index}.amount` as const)} placeholder="Amount" />
                      <Button type="button" variant="ghost" size="sm" onClick={() => removeSplit(index)}>
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
          <div className="h-full w-full max-w-md overflow-y-auto bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Create transfer</h2>
                <p className="text-sm text-gray-500">Move funds between accounts without affecting budgets.</p>
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
