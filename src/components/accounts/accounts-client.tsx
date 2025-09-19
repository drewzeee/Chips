"use client";

import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { accountSchema } from "@/lib/validators";
import { parseAmountToCents, formatCurrency } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from "@/components/ui/table";

const formSchema = accountSchema.omit({ id: true }).extend({
  openingBalance: z.string(),
  creditLimit: z.string().optional().nullable(),
});

export type AccountWithBalance = {
  id: string;
  name: string;
  type: "CHECKING" | "SAVINGS" | "CREDIT_CARD" | "CASH" | "INVESTMENT";
  currency: string;
  openingBalance: number;
  creditLimit: number | null;
  status: "ACTIVE" | "CLOSED" | "HIDDEN";
  institution: string | null;
  notes: string | null;
  createdAt: string;
  balance: number;
};

const ACCOUNT_TYPES = [
  { value: "CHECKING", label: "Checking" },
  { value: "SAVINGS", label: "Savings" },
  { value: "CREDIT_CARD", label: "Credit Card" },
  { value: "CASH", label: "Cash" },
  { value: "INVESTMENT", label: "Investment" },
];

const ACCOUNT_STATUS = [
  { value: "ACTIVE", label: "Active" },
  { value: "CLOSED", label: "Closed" },
  { value: "HIDDEN", label: "Hidden" },
];

type FormValues = z.infer<typeof formSchema>;

export function AccountsClient({
  initialAccounts,
  defaultCurrency = "USD",
}: {
  initialAccounts: AccountWithBalance[];
  defaultCurrency?: string;
}) {
  const [accounts, setAccounts] = useState(initialAccounts);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const selectedAccount = useMemo(() => accounts.find((account) => account.id === selectedId), [
    accounts,
    selectedId,
  ]);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      type: "CHECKING",
      currency: defaultCurrency,
      openingBalance: "0",
      creditLimit: "",
      status: "ACTIVE",
      institution: "",
      notes: "",
    },
  });

  const resetForm = () => {
    setSelectedId(null);
    form.reset({
      name: "",
      type: "CHECKING",
      currency: defaultCurrency,
      openingBalance: "0",
      creditLimit: "",
      status: "ACTIVE",
      institution: "",
      notes: "",
    });
  };

  const handleEdit = (account: AccountWithBalance) => {
    setSelectedId(account.id);
    form.reset({
      name: account.name,
      type: account.type,
      currency: account.currency,
      openingBalance: (account.openingBalance / 100).toString(),
      creditLimit: account.creditLimit ? (account.creditLimit / 100).toString() : "",
      status: account.status,
      institution: account.institution ?? "",
      notes: account.notes ?? "",
    });
  };

  const onSubmit = form.handleSubmit(async (values) => {
    setFormError(null);
    setLoading(true);

    const payload = {
      name: values.name,
      type: values.type,
      currency: values.currency.toUpperCase(),
      openingBalance: parseAmountToCents(values.openingBalance),
      creditLimit: values.creditLimit ? parseAmountToCents(values.creditLimit) : null,
      status: values.status,
      institution: values.institution || null,
      notes: values.notes || null,
    };

    try {
      const response = await fetch(selectedId ? `/api/accounts/${selectedId}` : "/api/accounts", {
        method: selectedId ? "PUT" : "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const result = await response.json().catch(() => null);
        throw new Error(result?.error ?? "Unable to save account");
      }

      const account = await response.json();
      setAccounts((prev) => {
        if (selectedId) {
          return prev.map((item) =>
            item.id === account.id
              ? {
                  ...item,
                  ...account,
                  balance: account.openingBalance + (item.balance - item.openingBalance),
                }
              : item
          );
        }
        return [...prev, { ...account, balance: account.openingBalance }];
      });
      resetForm();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Unexpected error");
    } finally {
      setLoading(false);
    }
  });

  const handleDelete = async (id: string) => {
    if (!window.confirm("Delete this account? You cannot undo this.")) {
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`/api/accounts/${id}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const result = await response.json().catch(() => null);
        throw new Error(result?.error ?? "Unable to delete account");
      }
      setAccounts((prev) => prev.filter((account) => account.id !== id));
      if (selectedId === id) {
        resetForm();
      }
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Unexpected error");
    } finally {
      setLoading(false);
    }
  };

  const totals = useMemo(() => {
    const totalBalance = accounts.reduce((sum, account) => sum + account.balance, 0);
    const activeAccounts = accounts.filter((account) => account.status === "ACTIVE");
    return {
      totalBalance,
      activeAccounts: activeAccounts.length,
      creditUtilization: accounts
        .filter((account) => account.type === "CREDIT_CARD" && account.creditLimit)
        .reduce((accumulator, account) => {
          const limit = account.creditLimit ?? 0;
          const used = limit + account.balance;
          return accumulator + (limit > 0 ? used / limit : 0);
        }, 0) / Math.max(1, accounts.filter((account) => account.type === "CREDIT_CARD" && account.creditLimit).length),
    };
  }, [accounts]);

  return (
    <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Accounts</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHead>
                <TableRow>
                  <TableHeaderCell>Name</TableHeaderCell>
                  <TableHeaderCell>Type</TableHeaderCell>
                  <TableHeaderCell>Status</TableHeaderCell>
                  <TableHeaderCell className="text-right">Balance</TableHeaderCell>
                  <TableHeaderCell className="text-right">Opening</TableHeaderCell>
                  <TableHeaderCell></TableHeaderCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {accounts.map((account) => (
                  <TableRow key={account.id}>
                    <TableCell className="font-medium text-gray-800">{account.name}</TableCell>
                    <TableCell>{account.type.replace("_", " ")}</TableCell>
                    <TableCell>{account.status}</TableCell>
                    <TableCell className="text-right font-semibold">
                      {formatCurrency(account.balance, account.currency)}
                    </TableCell>
                    <TableCell className="text-right text-gray-500">
                      {formatCurrency(account.openingBalance, account.currency)}
                    </TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button variant="ghost" size="sm" onClick={() => handleEdit(account)}>
                        Edit
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-red-600 hover:text-red-700 dark:text-rose-300 dark:hover:text-rose-200"
                        onClick={() => handleDelete(account.id)}
                      >
                        Delete
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>{selectedAccount ? "Edit account" : "Add account"}</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={onSubmit}>
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input id="name" {...form.register("name")} />
                {form.formState.errors.name && (
                  <p className="text-sm text-red-600">{form.formState.errors.name.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="type">Type</Label>
                <Select id="type" {...form.register("type")}>
                  {ACCOUNT_TYPES.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="flex gap-4">
                <div className="flex-1 space-y-2">
                  <Label htmlFor="currency">Currency (ISO)</Label>
                  <Input id="currency" maxLength={3} {...form.register("currency")} />
                </div>
                <div className="flex-1 space-y-2">
                  <Label htmlFor="status">Status</Label>
                  <Select id="status" {...form.register("status")}>
                    {ACCOUNT_STATUS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="flex-1 space-y-2">
                  <Label htmlFor="openingBalance">Opening balance</Label>
                  <Input id="openingBalance" {...form.register("openingBalance")} />
                </div>
                <div className="flex-1 space-y-2">
                  <Label htmlFor="creditLimit">Credit limit</Label>
                  <Input id="creditLimit" placeholder="Optional" {...form.register("creditLimit")} />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="institution">Institution</Label>
                <Input id="institution" placeholder="Optional" {...form.register("institution")} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea id="notes" rows={3} placeholder="Optional" {...form.register("notes")} />
              </div>

              {formError && <p className="text-sm text-red-600">{formError}</p>}

              <div className="flex items-center gap-2">
                <Button type="submit" disabled={loading}>
                  {loading ? "Saving..." : selectedAccount ? "Save changes" : "Create account"}
                </Button>
                {selectedAccount && (
                  <Button type="button" variant="secondary" onClick={resetForm}>
                    Cancel
                  </Button>
                )}
              </div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Overview</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Total balance</span>
              <span className="font-semibold">{formatCurrency(totals.totalBalance)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Active accounts</span>
              <span className="font-semibold">{totals.activeAccounts}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Avg. credit utilization</span>
              <span className="font-semibold">
                {Number.isFinite(totals.creditUtilization)
                  ? `${Math.round(totals.creditUtilization * 100)}%`
                  : "N/A"}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
