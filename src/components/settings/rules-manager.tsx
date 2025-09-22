"use client";

import { Fragment, useState } from "react";
import { format } from "date-fns";
import { formatCurrency } from "@/lib/utils";
import { transactionRuleSchema } from "@/lib/validators";
import type { TransactionRule } from "@/lib/types";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Label } from "@/components/ui/label";

type RuleWithRelations = TransactionRule;

interface Option {
  id: string;
  name: string;
  type?: string;
}

const ruleFormSchema = transactionRuleSchema.omit({ id: true }).extend({
  amountEquals: z.string().optional().nullable(),
});

type RuleFormValues = z.infer<typeof ruleFormSchema>;

interface RulePreviewTransaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  account: {
    id: string;
    name: string;
    currency: string | null;
  };
  existingSplitCount: number;
}

interface RulePreviewResult {
  count: number;
  limit: number;
  transactions: RulePreviewTransaction[];
}

interface PreviewState {
  ruleId: string | null;
  loading: boolean;
  applying: boolean;
  data: RulePreviewResult | null;
  error: string | null;
  message: string | null;
}

const createEmptyPreviewState = (): PreviewState => ({
  ruleId: null,
  loading: false,
  applying: false,
  data: null,
  error: null,
  message: null,
});

interface RulesManagerProps {
  initialRules: RuleWithRelations[];
  categories: Option[];
  accounts: Option[];
}

export function RulesManager({ initialRules, categories, accounts }: RulesManagerProps) {
  const [rules, setRules] = useState(initialRules);
  const [activeRuleId, setActiveRuleId] = useState<string | null>(null);
  const [formValues, setFormValues] = useState<RuleFormValues>({
    name: "",
    categoryId: "",
    accountId: "",
    descriptionStartsWith: "",
    descriptionContains: "",
    amountEquals: "",
    priority: 100,
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [previewState, setPreviewState] = useState<PreviewState>(() => createEmptyPreviewState());
  const [importing, setImporting] = useState(false);
  const [importMessage, setImportMessage] = useState<string | null>(null);

  const resetForm = () => {
    setActiveRuleId(null);
    setFormValues({
      name: "",
      categoryId: "",
      accountId: "",
      descriptionStartsWith: "",
      descriptionContains: "",
      amountEquals: "",
      priority: 100,
    });
    setFormError(null);
  };

  const populateForm = (rule: RuleWithRelations) => {
    setActiveRuleId(rule.id);
    setFormValues({
      name: rule.name,
      categoryId: rule.categoryId,
      accountId: rule.accountId ?? "",
      descriptionStartsWith: rule.descriptionStartsWith ?? "",
      descriptionContains: rule.descriptionContains ?? "",
      amountEquals:
        rule.amountEquals != null
          ? (rule.amountEquals / 100).toFixed(2)
          : "",
      priority: rule.priority,
    });
    setFormError(null);
  };

  const handleChange = (field: keyof RuleFormValues, value: string | number) => {
    setFormValues((prev) => ({ ...prev, [field]: value }));
  };

  const fetchRulePreview = async (ruleId: string) => {
    const response = await fetch(`/api/settings/rules/${ruleId}/preview`, {
      method: "POST",
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => null);
      throw new Error(payload?.error ?? "Unable to preview rule");
    }

    return (await response.json()) as RulePreviewResult;
  };

  const handlePreview = async (ruleId: string) => {
    setPreviewState({
      ruleId,
      loading: true,
      applying: false,
      data: null,
      error: null,
      message: null,
    });

    try {
      const preview = await fetchRulePreview(ruleId);
      setPreviewState({
        ruleId,
        loading: false,
        applying: false,
        data: preview,
        error: null,
        message: null,
      });
    } catch (error) {
      setPreviewState({
        ruleId,
        loading: false,
        applying: false,
        data: null,
        error: error instanceof Error ? error.message : "Unexpected error",
        message: null,
      });
    }
  };

  const handleApply = async (ruleId: string) => {
    setPreviewState((prev) => ({
      ...prev,
      applying: true,
      error: null,
      message: null,
    }));

    try {
      const response = await fetch(`/api/settings/rules/${ruleId}/apply`, {
        method: "POST",
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error ?? "Unable to apply rule");
      }

      const result = (await response.json()) as {
        updated: number;
        skipped: number;
      };
      const preview = await fetchRulePreview(ruleId);

      const messageParts: string[] = [];
      if (result.updated > 0) {
        messageParts.push(
          `Applied to ${result.updated} transaction${result.updated === 1 ? "" : "s"}.`
        );
      }

      if (result.skipped > 0) {
        messageParts.push(
          `Skipped ${result.skipped} already categorised or multi-split transaction${
            result.skipped === 1 ? "" : "s"
          }.`
        );
      }

      const combinedMessage = messageParts.join(" ") || "No transactions needed updating.";

      setPreviewState({
        ruleId,
        loading: false,
        applying: false,
        data: preview,
        error: null,
        message: combinedMessage,
      });
    } catch (error) {
      setPreviewState((prev) => ({
        ...prev,
        applying: false,
        loading: false,
        error: error instanceof Error ? error.message : "Unexpected error",
      }));
    }
  };

  const handleClosePreview = () => {
    setPreviewState(createEmptyPreviewState());
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);

    const parsed = ruleFormSchema.safeParse(formValues);
    if (!parsed.success) {
      const message = Object.values(parsed.error.flatten().fieldErrors)
        .flat()
        .filter(Boolean)[0];
      setFormError(message ?? "Check the rule details and try again.");
      return;
    }

    try {
      setPending(true);
      const normalizedAmount = parsed.data.amountEquals?.trim() ?? "";
      const payload = {
        ...parsed.data,
        accountId: parsed.data.accountId || null,
        descriptionStartsWith: parsed.data.descriptionStartsWith?.trim() || null,
        descriptionContains: parsed.data.descriptionContains?.trim() || null,
        amountEquals: normalizedAmount && normalizedAmount !== "" ? normalizedAmount : null,
        priority: parsed.data.priority ?? 100,
      };

      const response = await fetch(
        activeRuleId ? `/api/settings/rules/${activeRuleId}` : "/api/settings/rules",
        {
          method: activeRuleId ? "PUT" : "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        }
      );

      if (!response.ok) {
        const errorPayload = await response.json().catch(() => null);
        throw new Error(errorPayload?.error ?? "Unable to save rule");
      }

      const rule = (await response.json()) as RuleWithRelations;
      setRules((prev) => {
        const without = prev.filter((item) => item.id !== rule.id);
        return [...without, rule].sort((a, b) => a.priority - b.priority || a.name.localeCompare(b.name));
      });
      setPreviewState((prev) => (prev.ruleId === rule.id ? createEmptyPreviewState() : prev));
      resetForm();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Unexpected error");
    } finally {
      setPending(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Delete this rule?")) {
      return;
    }

    try {
      const response = await fetch(`/api/settings/rules/${id}`, { method: "DELETE" });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error ?? "Unable to delete rule");
      }
      setRules((prev) => prev.filter((rule) => rule.id !== id));
      setPreviewState((prev) => (prev.ruleId === id ? createEmptyPreviewState() : prev));
      if (activeRuleId === id) {
        resetForm();
      }
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Unexpected error");
    }
  };

  const handleExport = async () => {
    try {
      const response = await fetch('/api/settings/rules/export');
      if (!response.ok) {
        throw new Error('Failed to export rules');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = `transaction-rules-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Failed to export rules');
    }
  };

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setImporting(true);
    setImportMessage(null);
    setFormError(null);

    try {
      const text = await file.text();
      const data = JSON.parse(text);

      const response = await fetch('/api/settings/rules/import', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.error || 'Failed to import rules');
      }

      const result = await response.json();

      // Refresh rules list
      const rulesResponse = await fetch('/api/settings/rules');
      if (rulesResponse.ok) {
        const updatedRules = await rulesResponse.json();
        setRules(updatedRules);
      }

      const messages = [];
      if (result.imported > 0) {
        messages.push(`${result.imported} rule${result.imported === 1 ? '' : 's'} imported successfully`);
      }
      if (result.skipped > 0) {
        messages.push(`${result.skipped} rule${result.skipped === 1 ? '' : 's'} skipped`);
      }
      if (result.errors?.length > 0) {
        messages.push(`Errors: ${result.errors.slice(0, 3).join(', ')}${result.errors.length > 3 ? '...' : ''}`);
      }

      setImportMessage(messages.join('. ') || 'Import completed');
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Failed to import rules');
    } finally {
      setImporting(false);
      // Reset file input
      event.target.value = '';
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Auto-categorisation rules</CardTitle>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleExport}
              disabled={rules.length === 0}
            >
              Export Rules
            </Button>
            <div className="relative">
              <input
                type="file"
                accept=".json"
                onChange={handleImport}
                disabled={importing}
                className="absolute inset-0 opacity-0 cursor-pointer"
                aria-label="Import rules file"
              />
              <Button
                variant="outline"
                size="sm"
                disabled={importing}
              >
                {importing ? 'Importing...' : 'Import Rules'}
              </Button>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <form className="grid gap-4 md:grid-cols-2" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label htmlFor="rule-name">Rule name</Label>
            <Input
              id="rule-name"
              value={formValues.name}
              onChange={(event) => handleChange("name", event.target.value)}
              placeholder="e.g. Chase payment"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="rule-category">Category</Label>
            <Select
              id="rule-category"
              value={formValues.categoryId}
              onChange={(event) => handleChange("categoryId", event.target.value)}
              required
            >
              <option value="">Select category</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="rule-account">Account (optional)</Label>
            <Select
              id="rule-account"
              value={formValues.accountId ?? ""}
              onChange={(event) => handleChange("accountId", event.target.value)}
            >
              <option value="">All accounts</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="rule-priority">Priority</Label>
            <Input
              id="rule-priority"
              type="number"
              min={1}
              max={999}
              value={formValues.priority ?? 100}
              onChange={(event) => handleChange("priority", Number(event.target.value))}
            />
            <p className="text-xs text-gray-500 dark:text-gray-400">Lower numbers run first (default 100).</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="rule-starts">Description starts with</Label>
            <Input
              id="rule-starts"
              value={formValues.descriptionStartsWith ?? ""}
              onChange={(event) => handleChange("descriptionStartsWith", event.target.value)}
              placeholder="e.g. PAYMENT THANK YOU"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="rule-contains">Description contains</Label>
            <Input
              id="rule-contains"
              value={formValues.descriptionContains ?? ""}
              onChange={(event) => handleChange("descriptionContains", event.target.value)}
              placeholder="Optional"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="rule-amount">Exact amount (optional)</Label>
            <Input
              id="rule-amount"
              value={formValues.amountEquals ?? ""}
              onChange={(event) => handleChange("amountEquals", event.target.value)}
              placeholder="e.g. 8098.91"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400">Use positive numbers; the sign is ignored.</p>
          </div>
          <div className="flex items-end gap-2">
            <Button type="submit" disabled={pending}>
              {activeRuleId ? "Update rule" : "Create rule"}
            </Button>
            <Button type="button" variant="secondary" onClick={resetForm} disabled={pending}>
              Clear
            </Button>
          </div>
        </form>

        {formError && <p className="text-sm text-red-600">{formError}</p>}
        {importMessage && <p className="text-sm text-green-600">{importMessage}</p>}

        <div className="space-y-3">
          <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">Existing rules</h3>
          {rules.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">No rules yet. Create one to start auto-categorising.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[620px] text-left text-sm">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700 text-xs uppercase text-gray-500 dark:text-gray-400">
                    <th className="px-3 py-2">Name</th>
                    <th className="px-3 py-2">Category</th>
                    <th className="px-3 py-2">Account</th>
                    <th className="px-3 py-2">Description match</th>
                    <th className="px-3 py-2">Amount</th>
                    <th className="px-3 py-2">Priority</th>
                    <th className="px-3 py-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {rules
                    .slice()
                    .sort((a, b) => a.priority - b.priority || a.name.localeCompare(b.name))
                    .map((rule) => (
                      <Fragment key={rule.id}>
                        <tr className="hover:bg-gray-50 dark:hover:bg-gray-800">
                          <td className="px-3 py-3">
                            <div className="font-medium text-gray-900 dark:text-gray-100">{rule.name}</div>
                          </td>
                          <td className="px-3 py-3 text-gray-700 dark:text-gray-300">{rule.category.name}</td>
                          <td className="px-3 py-3 text-gray-500 dark:text-gray-400">{rule.account?.name ?? "All"}</td>
                          <td className="px-3 py-3 text-gray-500 dark:text-gray-400">
                            {rule.descriptionStartsWith && (
                              <div>Starts: {rule.descriptionStartsWith}</div>
                            )}
                            {rule.descriptionContains && (
                              <div>Contains: {rule.descriptionContains}</div>
                            )}
                            {!rule.descriptionStartsWith && !rule.descriptionContains && <div>—</div>}
                          </td>
                          <td className="px-3 py-3 text-gray-500 dark:text-gray-400">
                            {rule.amountEquals != null
                              ? formatCurrency(Math.abs(rule.amountEquals), rule.account?.currency ?? "USD")
                              : "—"}
                          </td>
                          <td className="px-3 py-3 text-gray-500 dark:text-gray-400">{rule.priority}</td>
                          <td className="px-3 py-3 text-right space-x-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handlePreview(rule.id)}
                              disabled={
                                (previewState.loading || previewState.applying) && previewState.ruleId === rule.id
                              }
                            >
                              Test run
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => populateForm(rule)}>
                              Edit
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-red-600 hover:text-red-700 dark:text-rose-300 dark:hover:text-rose-200"
                              onClick={() => handleDelete(rule.id)}
                            >
                              Delete
                            </Button>
                          </td>
                        </tr>
                        {previewState.ruleId === rule.id && (
                          <tr>
                            <td colSpan={7} className="bg-gray-50 dark:bg-gray-800 px-3 py-4 text-sm text-gray-700 dark:text-gray-300">
                              <div className="space-y-3">
                                {previewState.loading ? (
                                  <p>Testing rule...</p>
                                ) : previewState.error ? (
                                  <div className="flex flex-wrap items-center justify-between gap-3">
                                    <p className="text-sm text-red-600 dark:text-red-400">{previewState.error}</p>
                                    <div className="flex gap-2">
                                      <Button size="sm" onClick={() => handlePreview(rule.id)}>
                                        Retry
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="secondary"
                                        onClick={handleClosePreview}
                                        disabled={previewState.applying}
                                      >
                                        Close
                                      </Button>
                                    </div>
                                  </div>
                                ) : previewState.data ? (
                                  <>
                                    <div className="flex flex-wrap items-center justify-between gap-3">
                                      <div>
                                        <p className="font-medium text-gray-900 dark:text-gray-100">
                                          {previewState.data.count === 0
                                            ? "No transactions would be affected."
                                            : `${previewState.data.count} transaction${
                                                previewState.data.count === 1 ? "" : "s"
                                              } match this rule.`}
                                        </p>
                                        {previewState.data.count > previewState.data.transactions.length && (
                                          <p className="text-xs text-gray-500 dark:text-gray-400">
                                            Showing first {previewState.data.transactions.length} of {previewState.data.count} matches.
                                          </p>
                                        )}
                                        {previewState.data.transactions.some((transaction) => transaction.existingSplitCount > 0) && (
                                          <p className="text-xs text-gray-500 dark:text-gray-400">
                                            Existing single-category assignments will be replaced. Multi-split transactions are skipped.
                                          </p>
                                        )}
                                      </div>
                                      <div className="flex gap-2">
                                        {previewState.data.count > 0 && (
                                          <Button
                                            size="sm"
                                            onClick={() => handleApply(rule.id)}
                                            disabled={previewState.applying}
                                          >
                                            {previewState.applying
                                              ? "Applying..."
                                              : `Apply to ${previewState.data.count}`}
                                          </Button>
                                        )}
                                        <Button
                                          size="sm"
                                          variant="secondary"
                                          onClick={handleClosePreview}
                                          disabled={previewState.applying}
                                        >
                                          Close
                                        </Button>
                                      </div>
                                    </div>
                                    {previewState.message && (
                                      <p className="text-xs text-green-600 dark:text-green-400">{previewState.message}</p>
                                    )}
                                    {previewState.data.transactions.length > 0 && (
                                      <div className="overflow-x-auto">
                                        <table className="w-full min-w-[620px] text-xs">
                                          <thead>
                                            <tr className="border-b border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400">
                                              <th className="px-2 py-2 text-left">Date</th>
                                              <th className="px-2 py-2 text-left">Account</th>
                                              <th className="px-2 py-2 text-left">Description</th>
                                              <th className="px-2 py-2 text-left">Action</th>
                                              <th className="px-2 py-2 text-right">Amount</th>
                                            </tr>
                                          </thead>
                                          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                            {previewState.data.transactions.map((transaction) => (
                                              <tr key={transaction.id}>
                                                <td className="px-2 py-2 text-gray-600 dark:text-gray-300">
                                                  {format(new Date(transaction.date), "MMM d, yyyy")}
                                                </td>
                                                <td className="px-2 py-2 text-gray-600 dark:text-gray-300">{transaction.account.name}</td>
                                                <td className="px-2 py-2 text-gray-600 dark:text-gray-300">{transaction.description}</td>
                                                <td className="px-2 py-2 text-gray-600 dark:text-gray-300">
                                                  {transaction.existingSplitCount > 0 ? "Replace existing category" : "Assign category"}
                                                </td>
                                                <td className="px-2 py-2 text-right text-gray-600">
                                                  {formatCurrency(
                                                    transaction.amount,
                                                    transaction.account.currency ?? "USD"
                                                  )}
                                                </td>
                                              </tr>
                                            ))}
                                          </tbody>
                                        </table>
                                      </div>
                                    )}
                                  </>
                                ) : (
                                  <p>No preview data available.</p>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
