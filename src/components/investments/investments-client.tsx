"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { investmentAccountSchema, investmentAssetSchema } from "@/lib/validators";
import { parseAmountToCents, formatCurrency } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

export interface InvestmentValuationItem {
  id: string;
  value: number;
  asOf: string;
  createdAt: string;
}

export interface InvestmentTradeItem {
  id: string;
  type: "BUY" | "SELL" | "DEPOSIT" | "WITHDRAW" | "DIVIDEND" | "INTEREST" | "FEE" | "ADJUSTMENT";
  assetType: "CRYPTO" | "EQUITY" | null;
  symbol: string | null;
  quantity: string | null;
  pricePerUnit: string | null;
  amount: number;
  fees: number | null;
  occurredAt: string;
  notes: string | null;
}

export interface InvestmentAssetValuationItem {
  id: string;
  value: number;
  quantity: string | null;
  asOf: string;
  createdAt: string;
}

export interface InvestmentAssetItem {
  id: string;
  name: string;
  symbol: string | null;
  type: "CRYPTO" | "EQUITY";
  createdAt: string;
  valuations: InvestmentAssetValuationItem[];
  recentTransactions?: Array<{
    id: string;
    type: InvestmentTradeItem["type"];
    amount: number;
    occurredAt: string;
  }>;
}

export interface InvestmentAccountDetail {
  investmentAccountId: string;
  accountId: string;
  name: string;
  currency: string;
  status: "ACTIVE" | "CLOSED" | "HIDDEN";
  assetClass: "CRYPTO" | "EQUITY" | "MIXED";
  kind: "BROKERAGE" | "WALLET";
  openingBalance: number;
  balance: number;
  institution: string | null;
  notes: string | null;
  createdAt: string;
  valuations: InvestmentValuationItem[];
  trades: InvestmentTradeItem[];
  assets: InvestmentAssetItem[];
}

interface ApiInvestmentAccountResponse {
  investmentAccountId: string;
  assetClass: InvestmentAccountDetail["assetClass"];
  kind: InvestmentAccountDetail["kind"];
  balance: number;
  account: {
    id: string;
    name: string;
    currency: string;
    status: InvestmentAccountDetail["status"];
    openingBalance: number;
    institution: string | null;
    notes: string | null;
    createdAt: string;
  };
  latestValuation: {
    value: number;
    asOf: string;
  } | null;
}

interface ApiAssetResponse {
  id: string;
  name: string;
  symbol: string | null;
  type: InvestmentAssetItem["type"];
  createdAt: string;
  valuations: Array<{
    id: string;
    value: number;
    quantity: string | null;
    asOf: string;
    createdAt: string;
  }>;
  recentTransactions: Array<{
    id: string;
    type: InvestmentTradeItem["type"];
    amount: number;
    occurredAt: string;
  }>;
}

const accountFormSchema = investmentAccountSchema
  .omit({ id: true })
  .extend({
    openingBalance: z.string(),
    creditLimit: z.string().optional().nullable(),
  });

const valuationFormSchema = z.object({
  value: z.string().min(1, "Value is required"),
  asOf: z.string().min(1, "Date is required"),
});

const tradeFormSchema = z.object({
  type: z.enum(["BUY", "SELL", "DEPOSIT", "WITHDRAW", "DIVIDEND", "INTEREST", "FEE", "ADJUSTMENT"]),
  assetType: z.enum(["CRYPTO", "EQUITY"]).optional().nullable(),
  symbol: z.string().optional().nullable(),
  quantity: z.string().optional().nullable(),
  pricePerUnit: z.string().optional().nullable(),
  amount: z.string().min(1, "Amount is required"),
  fees: z.string().optional().nullable(),
  occurredAt: z.string().min(1, "Date is required"),
  notes: z.string().optional().nullable(),
});

const assetFormSchema = investmentAssetSchema
  .omit({ id: true, investmentAccountId: true })
  .extend({
    symbol: z.string().optional().nullable(),
  });

const assetValuationFormSchema = z.object({
  assetId: z.string().min(1, "Asset is required"),
  value: z.string().min(1, "Value is required"),
  quantity: z.string().optional().nullable(),
  asOf: z.string().min(1, "Date is required"),
});

type AccountFormValues = z.infer<typeof accountFormSchema>;
type ValuationFormValues = z.infer<typeof valuationFormSchema>;
type TradeFormValues = z.infer<typeof tradeFormSchema>;
type AssetFormValues = z.infer<typeof assetFormSchema>;
type AssetValuationFormValues = z.infer<typeof assetValuationFormSchema>;

const assetClassTone: Record<InvestmentAccountDetail["assetClass"], "default" | "success" | "warning"> = {
  CRYPTO: "warning",
  EQUITY: "success",
  MIXED: "default",
};

function mapAssetResponse(item: ApiAssetResponse): InvestmentAssetItem {
  return {
    id: item.id,
    name: item.name,
    symbol: item.symbol,
    type: item.type,
    createdAt: item.createdAt,
    valuations: item.valuations.map((valuation) => ({
      id: valuation.id,
      value: valuation.value,
      quantity: valuation.quantity,
      asOf: valuation.asOf,
      createdAt: valuation.createdAt,
    })),
    recentTransactions: item.recentTransactions,
  };
}

interface SidePanelProps {
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  children: React.ReactNode;
}

function SidePanel({ open, title, description, onClose, children }: SidePanelProps) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-40 flex">
      <div className="fixed inset-0 bg-black/60" onClick={onClose} aria-hidden />
      <aside className="relative ml-auto flex h-full w-full max-w-xl flex-col bg-[var(--card)] p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-[var(--card-foreground)]">{title}</h2>
            {description ? (
              <p className="mt-1 text-sm text-[var(--muted-foreground)]">{description}</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-transparent p-1 text-[var(--muted-foreground)] transition hover:border-[var(--border)] hover:text-[var(--foreground)]"
            aria-label="Close panel"
          >
            ×
          </button>
        </div>
        <div className="mt-6 flex-1 overflow-y-auto pb-8">{children}</div>
      </aside>
    </div>
  );
}

export function InvestmentsClient({
  initialAccounts,
  defaultCurrency = "USD",
}: {
  initialAccounts: InvestmentAccountDetail[];
  defaultCurrency?: string;
}) {
  const [accounts, setAccounts] = useState(initialAccounts);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(
    initialAccounts[0]?.investmentAccountId ?? null
  );
  const [initialized, setInitialized] = useState(false);

  const [accountDrawerMode, setAccountDrawerMode] = useState<"create" | "edit">("create");
  const [accountDrawerOpen, setAccountDrawerOpen] = useState(false);
  const [editingAccountId, setEditingAccountId] = useState<string | null>(null);

  const [accountError, setAccountError] = useState<string | null>(null);
  const [accountLoading, setAccountLoading] = useState(false);

  const [valuationLoading, setValuationLoading] = useState(false);
  const [valuationError, setValuationError] = useState<string | null>(null);

  const [tradeLoading, setTradeLoading] = useState(false);
  const [tradeError, setTradeError] = useState<string | null>(null);

  const [assetError, setAssetError] = useState<string | null>(null);
  const [assetLoading, setAssetLoading] = useState(false);
  const [assetFormMode, setAssetFormMode] = useState<"create" | "edit">("create");
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);

  const [assetValuationError, setAssetValuationError] = useState<string | null>(null);
  const [assetValuationLoading, setAssetValuationLoading] = useState(false);

  const accountForm = useForm<AccountFormValues>({
    resolver: zodResolver(accountFormSchema),
    defaultValues: {
      name: "",
      type: "INVESTMENT",
      currency: defaultCurrency,
      openingBalance: "0",
      creditLimit: "",
      status: "ACTIVE",
      institution: "",
      notes: "",
      assetClass: "MIXED",
      kind: "BROKERAGE",
    },
  });

  const valuationForm = useForm<ValuationFormValues>({
    resolver: zodResolver(valuationFormSchema),
    defaultValues: {
      value: "0",
      asOf: new Date().toISOString().slice(0, 10),
    },
  });

  const tradeForm = useForm<TradeFormValues>({
    resolver: zodResolver(tradeFormSchema),
    defaultValues: {
      type: "BUY",
      assetType: "CRYPTO",
      symbol: "",
      quantity: "",
      pricePerUnit: "",
      amount: "0",
      fees: "",
      occurredAt: new Date().toISOString().slice(0, 10),
      notes: "",
    },
  });

  const assetForm = useForm<AssetFormValues>({
    resolver: zodResolver(assetFormSchema),
    defaultValues: {
      name: "",
      symbol: "",
      type: "CRYPTO",
    },
  });

  const assetValuationForm = useForm<AssetValuationFormValues>({
    resolver: zodResolver(assetValuationFormSchema),
    defaultValues: {
      assetId: "",
      value: "0",
      quantity: "",
      asOf: new Date().toISOString().slice(0, 10),
    },
  });

  const selectedAccount = useMemo(
    () => accounts.find((account) => account.investmentAccountId === selectedAccountId) ?? null,
    [accounts, selectedAccountId]
  );

  const selectedAsset = useMemo(
    () =>
      selectedAccount?.assets.find((asset) => asset.id === selectedAssetId) ?? null,
    [selectedAccount, selectedAssetId]
  );

  const totalInvested = useMemo(
    () => accounts.reduce((sum, account) => sum + account.balance, 0),
    [accounts]
  );

  useEffect(() => {
    if (!initialized && accounts.length > 0) {
      setSelectedAccountId(accounts[0].investmentAccountId);
      setInitialized(true);
    }
  }, [accounts, initialized]);

  const resetAccountForm = useCallback(() => {
    setEditingAccountId(null);
    setAccountDrawerMode("create");
    setAccountError(null);
    accountForm.reset({
      name: "",
      type: "INVESTMENT",
      currency: defaultCurrency,
      openingBalance: "0",
      creditLimit: "",
      status: "ACTIVE",
      institution: "",
      notes: "",
      assetClass: "MIXED",
      kind: "BROKERAGE",
    });
  }, [accountForm, defaultCurrency]);

  const resetAssetForm = useCallback(() => {
    setSelectedAssetId(null);
    setAssetFormMode("create");
    setAssetError(null);
    setAssetValuationError(null);
    assetForm.reset({
      name: "",
      symbol: "",
      type: "CRYPTO",
    });
    assetValuationForm.reset({
      assetId: "",
      value: "0",
      quantity: "",
      asOf: new Date().toISOString().slice(0, 10),
    });
  }, [assetForm, assetValuationForm]);

  const refreshAccounts = useCallback(async () => {
    const response = await fetch("/api/investments/accounts");
    if (!response.ok) {
      throw new Error("Unable to load investment accounts");
    }
    const data: ApiInvestmentAccountResponse[] = await response.json();
    setAccounts((previous) => {
      const detailMap = new Map(
        previous.map((item) => [item.investmentAccountId, item])
      );
      return data.map((item) => {
        const existing = detailMap.get(item.investmentAccountId);
        return {
          investmentAccountId: item.investmentAccountId,
          accountId: item.account.id,
          name: item.account.name,
          currency: item.account.currency,
          status: item.account.status,
          assetClass: item.assetClass,
          kind: item.kind,
          openingBalance: item.account.openingBalance,
          balance: item.balance,
          institution: item.account.institution ?? null,
          notes: item.account.notes ?? null,
          createdAt: typeof item.account.createdAt === "string"
            ? item.account.createdAt
            : new Date(item.account.createdAt).toISOString(),
          valuations: existing?.valuations ?? [],
          trades: existing?.trades ?? [],
          assets: existing?.assets ?? [],
        } satisfies InvestmentAccountDetail;
      });
    });
  }, []);

  const loadValuations = useCallback(async (investmentAccountId: string) => {
    const response = await fetch(`/api/investments/accounts/${investmentAccountId}/valuations`);
    if (!response.ok) {
      throw new Error("Unable to load valuations");
    }
    const data: InvestmentValuationItem[] = await response.json();
    setAccounts((previous) =>
      previous.map((account) =>
        account.investmentAccountId === investmentAccountId
          ? {
              ...account,
              valuations: data,
            }
          : account
      )
    );
  }, []);

  const loadTrades = useCallback(async (investmentAccountId: string) => {
    const response = await fetch(`/api/investments/accounts/${investmentAccountId}/transactions`);
    if (!response.ok) {
      throw new Error("Unable to load transactions");
    }
    const data: InvestmentTradeItem[] = await response.json();
    setAccounts((previous) =>
      previous.map((account) =>
        account.investmentAccountId === investmentAccountId
          ? {
              ...account,
              trades: data,
            }
          : account
      )
    );
  }, []);

  const loadAssets = useCallback(
    async (investmentAccountId: string) => {
      const response = await fetch(`/api/investments/accounts/${investmentAccountId}/assets`);
      if (!response.ok) {
        throw new Error("Unable to load assets");
      }
      const data: ApiAssetResponse[] = await response.json();
      setAccounts((previous) =>
        previous.map((account) =>
          account.investmentAccountId === investmentAccountId
            ? {
                ...account,
                assets: data.map(mapAssetResponse),
              }
            : account
        )
      );

      if (data.length > 0) {
        const targetAssetId = data.find((asset) => asset.id === selectedAssetId)?.id ?? data[0].id;
        const targetAsset = data.find((asset) => asset.id === targetAssetId)!;
        setSelectedAssetId(targetAssetId);
        setAssetFormMode("edit");
        assetForm.reset({
          name: targetAsset.name,
          symbol: targetAsset.symbol ?? "",
          type: targetAsset.type,
        });
        assetValuationForm.reset({
          assetId: targetAssetId,
          value: "0",
          quantity: "",
          asOf: new Date().toISOString().slice(0, 10),
        });
      } else {
        resetAssetForm();
      }
    },
    [assetForm, assetValuationForm, resetAssetForm, selectedAssetId]
  );

  const openCreateDrawer = () => {
    resetAccountForm();
    setAccountDrawerMode("create");
    setAccountDrawerOpen(true);
  };

  const openEditDrawer = (account: InvestmentAccountDetail) => {
    setEditingAccountId(account.investmentAccountId);
    setAccountDrawerMode("edit");
    setAccountError(null);
    accountForm.reset({
      name: account.name,
      type: "INVESTMENT",
      currency: account.currency,
      openingBalance: (account.openingBalance / 100).toString(),
      creditLimit: "",
      status: account.status,
      institution: account.institution ?? "",
      notes: account.notes ?? "",
      assetClass: account.assetClass,
      kind: account.kind,
    });
    setAccountDrawerOpen(true);
  };

  const closeAccountDrawer = () => {
    setAccountDrawerOpen(false);
    resetAccountForm();
  };

  const handleSelectAccount = useCallback(
    (investmentAccountId: string) => {
      setSelectedAccountId(investmentAccountId);
      setAssetError(null);
      setAssetValuationError(null);
      const account = accounts.find((item) => item.investmentAccountId === investmentAccountId);
      if (account) {
        loadValuations(investmentAccountId).catch(() => {});
        loadTrades(investmentAccountId).catch(() => {});
        loadAssets(investmentAccountId).catch(() => {});
      }
    },
    [accounts, loadAssets, loadTrades, loadValuations]
  );

  const onSubmitAccount = accountForm.handleSubmit(async (values) => {
    setAccountError(null);
    setAccountLoading(true);

    const payload = {
      name: values.name,
      type: "INVESTMENT",
      currency: values.currency.toUpperCase(),
      openingBalance: parseAmountToCents(values.openingBalance),
      creditLimit: values.creditLimit ? parseAmountToCents(values.creditLimit) : null,
      status: values.status,
      institution: values.institution || null,
      notes: values.notes || null,
      assetClass: values.assetClass,
      kind: values.kind,
    };

    const isEditing = accountDrawerMode === "edit" && editingAccountId;

    try {
      const endpoint = isEditing && editingAccountId
        ? `/api/investments/accounts/${editingAccountId}`
        : "/api/investments/accounts";

      const response = await fetch(endpoint, {
        method: isEditing ? "PUT" : "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const result = await response.json().catch(() => null);
        throw new Error(result?.error ?? "Unable to save investment account");
      }

      await refreshAccounts();

      if (isEditing && editingAccountId) {
        await Promise.all([
          loadValuations(editingAccountId),
          loadTrades(editingAccountId),
          loadAssets(editingAccountId),
        ]);
      } else {
        const result = await response.json().catch(() => null);
        if (result?.investmentAccountId) {
          setSelectedAccountId(result.investmentAccountId);
          await Promise.all([
            loadValuations(result.investmentAccountId),
            loadTrades(result.investmentAccountId),
            loadAssets(result.investmentAccountId),
          ]);
        }
      }

      closeAccountDrawer();
    } catch (error) {
      setAccountError(error instanceof Error ? error.message : "Unexpected error");
    } finally {
      setAccountLoading(false);
    }
  });

  const handleDeleteAccount = useCallback(
    async (investmentAccountId: string) => {
      if (!window.confirm("Delete this investment account? This action cannot be undone.")) {
        return;
      }

      setAccountLoading(true);
      setAccountError(null);
      try {
        const response = await fetch(`/api/investments/accounts/${investmentAccountId}`, {
          method: "DELETE",
        });
        if (!response.ok) {
          const result = await response.json().catch(() => null);
          throw new Error(result?.error ?? "Unable to delete investment account");
        }
        setAccounts((previous) =>
          previous.filter((account) => account.investmentAccountId !== investmentAccountId)
        );
        if (selectedAccountId === investmentAccountId) {
          setSelectedAccountId(null);
          resetAccountForm();
          resetAssetForm();
        }
      } catch (error) {
        setAccountError(error instanceof Error ? error.message : "Unexpected error");
      } finally {
        setAccountLoading(false);
      }
    },
    [resetAccountForm, resetAssetForm, selectedAccountId]
  );

  const onSubmitValuation = valuationForm.handleSubmit(async (values) => {
    if (!selectedAccount) {
      setValuationError("Select an account first");
      return;
    }

    setValuationError(null);
    setValuationLoading(true);

    const payload = {
      value: parseAmountToCents(values.value),
      asOf: values.asOf,
    };

    try {
      const response = await fetch(
        `/api/investments/accounts/${selectedAccount.investmentAccountId}/valuations`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        }
      );

      if (!response.ok) {
        const result = await response.json().catch(() => null);
        throw new Error(result?.error ?? "Unable to record valuation");
      }

      await Promise.all([
        refreshAccounts(),
        loadValuations(selectedAccount.investmentAccountId),
        loadAssets(selectedAccount.investmentAccountId),
      ]);

      valuationForm.reset({
        value: "0",
        asOf: new Date().toISOString().slice(0, 10),
      });
    } catch (error) {
      setValuationError(error instanceof Error ? error.message : "Unexpected error");
    } finally {
      setValuationLoading(false);
    }
  });

  const onSubmitTrade = tradeForm.handleSubmit(async (values) => {
    if (!selectedAccount) {
      setTradeError("Select an account first");
      return;
    }

    setTradeError(null);
    setTradeLoading(true);

    const payload = {
      type: values.type,
      assetType: values.assetType ?? undefined,
      symbol: values.symbol?.trim() || undefined,
      quantity: values.quantity?.trim() || undefined,
      pricePerUnit: values.pricePerUnit?.trim() || undefined,
      amount: parseAmountToCents(values.amount),
      fees: values.fees ? parseAmountToCents(values.fees) : null,
      occurredAt: values.occurredAt,
      notes: values.notes?.trim() || null,
    };

    try {
      const response = await fetch(
        `/api/investments/accounts/${selectedAccount.investmentAccountId}/transactions`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        }
      );

      if (!response.ok) {
        const result = await response.json().catch(() => null);
        throw new Error(result?.error ?? "Unable to record transaction");
      }

      tradeForm.reset({
        type: values.type,
        assetType: values.assetType ?? "CRYPTO",
        symbol: "",
        quantity: "",
        pricePerUnit: "",
        amount: "0",
        fees: "",
        occurredAt: new Date().toISOString().slice(0, 10),
        notes: "",
      });

      await Promise.all([
        refreshAccounts(),
        loadTrades(selectedAccount.investmentAccountId),
        loadAssets(selectedAccount.investmentAccountId),
      ]);
    } catch (error) {
      setTradeError(error instanceof Error ? error.message : "Unexpected error");
    } finally {
      setTradeLoading(false);
    }
  });

  const onSubmitAsset = assetForm.handleSubmit(async (values) => {
    if (!selectedAccount) {
      setAssetError("Select an account first");
      return;
    }

    setAssetError(null);
    setAssetLoading(true);

    const payload = {
      name: values.name,
      symbol: values.symbol?.trim() || null,
      type: values.type,
    };

    const isEditing = assetFormMode === "edit" && selectedAssetId;

    try {
      const endpoint = isEditing && selectedAssetId
        ? `/api/investments/accounts/${selectedAccount.investmentAccountId}/assets/${selectedAssetId}`
        : `/api/investments/accounts/${selectedAccount.investmentAccountId}/assets`;

      const response = await fetch(endpoint, {
        method: isEditing ? "PUT" : "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const result = await response.json().catch(() => null);
        throw new Error(result?.error ?? "Unable to save asset");
      }

      const result = await response.json().catch(() => null);

      await loadAssets(selectedAccount.investmentAccountId);

      if (result?.id) {
        setSelectedAssetId(result.id);
        setAssetFormMode("edit");
        assetForm.reset({
          name: result.name,
          symbol: result.symbol ?? "",
          type: result.type,
        });
        assetValuationForm.reset({
          assetId: result.id,
          value: "0",
          quantity: "",
          asOf: new Date().toISOString().slice(0, 10),
        });
      }
    } catch (error) {
      setAssetError(error instanceof Error ? error.message : "Unexpected error");
    } finally {
      setAssetLoading(false);
    }
  });

  const handleDeleteAsset = useCallback(
    async (assetId: string) => {
      if (!selectedAccount) return;
      if (!window.confirm("Delete this asset? This cannot be undone.")) {
        return;
      }

      setAssetLoading(true);
      setAssetError(null);
      try {
        const response = await fetch(
          `/api/investments/accounts/${selectedAccount.investmentAccountId}/assets/${assetId}`,
          {
            method: "DELETE",
          }
        );
        if (!response.ok) {
          const result = await response.json().catch(() => null);
          throw new Error(result?.error ?? "Unable to delete asset");
        }

        await loadAssets(selectedAccount.investmentAccountId);
      } catch (error) {
        setAssetError(error instanceof Error ? error.message : "Unexpected error");
      } finally {
        setAssetLoading(false);
      }
    },
    [loadAssets, selectedAccount]
  );

  const onSubmitAssetValuation = assetValuationForm.handleSubmit(async (values) => {
    if (!selectedAccount) {
      setAssetValuationError("Select an account first");
      return;
    }
    if (!values.assetId) {
      setAssetValuationError("Choose an asset to record a valuation");
      return;
    }

    setAssetValuationError(null);
    setAssetValuationLoading(true);

    const payload = {
      value: parseAmountToCents(values.value),
      quantity: values.quantity?.trim() || null,
      asOf: values.asOf,
    };

    try {
      const response = await fetch(
        `/api/investments/accounts/${selectedAccount.investmentAccountId}/assets/${values.assetId}/valuations`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        }
      );

      if (!response.ok) {
        const result = await response.json().catch(() => null);
        throw new Error(result?.error ?? "Unable to record asset valuation");
      }

      await Promise.all([
        loadAssets(selectedAccount.investmentAccountId),
        refreshAccounts(),
      ]);

      assetValuationForm.reset({
        assetId: values.assetId,
        value: "0",
        quantity: "",
        asOf: new Date().toISOString().slice(0, 10),
      });
    } catch (error) {
      setAssetValuationError(error instanceof Error ? error.message : "Unexpected error");
    } finally {
      setAssetValuationLoading(false);
    }
  });

  const currentAssetId = assetValuationForm.watch("assetId");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--foreground)]">Investments</h1>
          <p className="text-sm text-[var(--muted-foreground)]">
            Track brokerage accounts and crypto wallets, record holdings, and keep valuations up to date.
          </p>
        </div>
        <Button onClick={openCreateDrawer}>Add account</Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[320px,1fr]">
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Overview</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm text-[var(--muted-foreground)]">Total value</p>
                <p className="text-2xl font-semibold text-[var(--card-foreground)]">
                  {formatCurrency(totalInvested, selectedAccount?.currency ?? defaultCurrency)}
                </p>
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium text-[var(--muted-foreground)]">Accounts</p>
                <div className="space-y-2">
                  {accounts.map((account) => {
                    const active = account.investmentAccountId === selectedAccountId;
                    return (
                      <button
                        key={account.investmentAccountId}
                        type="button"
                        onClick={() => handleSelectAccount(account.investmentAccountId)}
                        className={`w-full rounded-lg border px-4 py-3 text-left transition ${
                          active
                            ? "border-[var(--primary)] bg-[var(--primary)]/10"
                            : "border-[var(--border)] hover:border-[var(--primary)]"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div>
                            <p className="font-medium text-[var(--foreground)]">{account.name}</p>
                            <p className="text-xs text-[var(--muted-foreground)]">
                              {formatCurrency(account.balance, account.currency)}
                            </p>
                          </div>
                          <div className="flex flex-col items-end gap-1">
                            <Badge tone={assetClassTone[account.assetClass]}>{account.assetClass}</Badge>
                            <Badge className="text-[10px] uppercase tracking-wide" tone="default">
                              {account.kind}
                            </Badge>
                          </div>
                        </div>
                        <div className="mt-2 flex gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            onClick={(event) => {
                              event.stopPropagation();
                              openEditDrawer(account);
                            }}
                          >
                            Edit account
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={(event) => {
                              event.stopPropagation();
                              handleDeleteAccount(account.investmentAccountId);
                            }}
                          >
                            Delete
                          </Button>
                        </div>
                      </button>
                    );
                  })}
                  {accounts.length === 0 && (
                    <p className="text-sm text-[var(--muted-foreground)]">No investment accounts yet.</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          {selectedAccount ? (
            <>
              <Card>
                <CardHeader>
                  <CardTitle>{selectedAccount.name}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <div>
                      <p className="text-sm text-[var(--muted-foreground)]">Current value</p>
                      <p className="text-lg font-semibold text-[var(--card-foreground)]">
                        {formatCurrency(selectedAccount.balance, selectedAccount.currency)}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-[var(--muted-foreground)]">Created</p>
                      <p className="text-lg font-semibold text-[var(--card-foreground)]">
                        {format(new Date(selectedAccount.createdAt), "MMM d, yyyy")}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-[var(--muted-foreground)]">Status</p>
                      <Badge>{selectedAccount.status}</Badge>
                    </div>
                    <div>
                      <p className="text-sm text-[var(--muted-foreground)]">Account type</p>
                      <p className="text-lg font-semibold text-[var(--card-foreground)]">
                        {selectedAccount.kind === "WALLET" ? "Wallet" : "Brokerage"}
                      </p>
                    </div>
                  </div>

                  <form className="grid gap-3 sm:grid-cols-3" onSubmit={onSubmitValuation}>
                    <div className="space-y-1">
                      <Label htmlFor="valuationValue">Total value</Label>
                      <Input id="valuationValue" {...valuationForm.register("value")}
                        placeholder="1000"
                        disabled={valuationLoading}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="valuationAsOf">As of</Label>
                      <Input id="valuationAsOf" type="date" {...valuationForm.register("asOf")}
                        disabled={valuationLoading}
                      />
                    </div>
                    <div className="flex items-end">
                      <Button type="submit" disabled={valuationLoading}>
                        Save valuation
                      </Button>
                    </div>
                    {valuationError && (
                      <div className="sm:col-span-3">
                        <p className="text-sm text-[var(--destructive)]">{valuationError}</p>
                      </div>
                    )}
                  </form>

                  <div className="overflow-x-auto">
                    <Table>
                      <TableHead>
                        <TableRow>
                          <TableHeaderCell>Date</TableHeaderCell>
                          <TableHeaderCell>Value</TableHeaderCell>
                          <TableHeaderCell>Recorded</TableHeaderCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {selectedAccount.valuations.map((valuation) => (
                          <TableRow key={valuation.id}>
                            <TableCell>{format(new Date(valuation.asOf), "MMM d, yyyy")}</TableCell>
                            <TableCell>{formatCurrency(valuation.value, selectedAccount.currency)}</TableCell>
                            <TableCell>{format(new Date(valuation.createdAt), "MMM d, yyyy p")}</TableCell>
                          </TableRow>
                        ))}
                        {selectedAccount.valuations.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={3} className="text-center text-sm text-[var(--muted-foreground)]">
                              No valuations recorded yet.
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Assets & Holdings</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid gap-6 lg:grid-cols-[260px,1fr]">
                    <div className="space-y-3">
                      <p className="text-sm text-[var(--muted-foreground)]">
                        Assets tracked for this {selectedAccount.kind === "WALLET" ? "wallet" : "account"}
                      </p>
                      <div className="space-y-2">
                        {selectedAccount.assets.map((asset) => {
                          const active = asset.id === selectedAssetId;
                          return (
                            <button
                              key={asset.id}
                              type="button"
                              onClick={() => {
                                setSelectedAssetId(asset.id);
                                setAssetFormMode("edit");
                                assetForm.reset({
                                  name: asset.name,
                                  symbol: asset.symbol ?? "",
                                  type: asset.type,
                                });
                                assetValuationForm.reset({
                                  assetId: asset.id,
                                  value: "0",
                                  quantity: "",
                                  asOf: new Date().toISOString().slice(0, 10),
                                });
                              }}
                              className={`w-full rounded-lg border px-3 py-2 text-left transition ${
                                active
                                  ? "border-[var(--primary)] bg-[var(--primary)]/10"
                                  : "border-[var(--border)] hover:border-[var(--primary)]"
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <span className="font-medium text-[var(--foreground)]">{asset.name}</span>
                                <Badge tone="default">{asset.type}</Badge>
                              </div>
                              {asset.symbol && (
                                <p className="text-xs text-[var(--muted-foreground)]">{asset.symbol}</p>
                              )}
                              {asset.valuations[0] && (
                                <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                                  Last value {formatCurrency(asset.valuations[0].value, selectedAccount.currency)}
                                </p>
                              )}
                            </button>
                          );
                        })}
                        {selectedAccount.assets.length === 0 && (
                          <p className="text-sm text-[var(--muted-foreground)]">No assets recorded yet.</p>
                        )}
                      </div>
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={resetAssetForm}
                        disabled={assetLoading}
                      >
                        Add new asset
                      </Button>
                    </div>

                    <div className="space-y-6">
                      <form className="space-y-3" onSubmit={onSubmitAsset}>
                        <div className="flex items-center justify-between">
                          <h3 className="text-sm font-semibold text-[var(--muted-foreground)]">
                            {assetFormMode === "edit" ? "Edit asset" : "Create asset"}
                          </h3>
                          {assetFormMode === "edit" && selectedAssetId && (
                            <Button
                              type="button"
                              variant="destructive"
                              size="sm"
                              onClick={() => handleDeleteAsset(selectedAssetId)}
                              disabled={assetLoading}
                            >
                              Delete
                            </Button>
                          )}
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <div className="space-y-1">
                            <Label htmlFor="assetName">Name</Label>
                            <Input id="assetName" {...assetForm.register("name")} placeholder="e.g. BTC Wallet" />
                          </div>
                          <div className="space-y-1">
                            <Label htmlFor="assetSymbol">Symbol</Label>
                            <Input id="assetSymbol" {...assetForm.register("symbol")} placeholder="Optional" />
                          </div>
                        </div>
                        <div className="space-y-1">
                          <Label htmlFor="assetType">Asset type</Label>
                          <Select id="assetType" {...assetForm.register("type")}> 
                            <option value="CRYPTO">Crypto</option>
                            <option value="EQUITY">Equity</option>
                          </Select>
                        </div>
                        {assetError && (
                          <p className="text-sm text-[var(--destructive)]">{assetError}</p>
                        )}
                        <Button type="submit" disabled={assetLoading}>
                          {assetFormMode === "edit" ? "Save asset" : "Add asset"}
                        </Button>
                      </form>

                      <form className="space-y-3" onSubmit={onSubmitAssetValuation}>
                        <h3 className="text-sm font-semibold text-[var(--muted-foreground)]">
                          Record asset valuation
                        </h3>
                        <input type="hidden" {...assetValuationForm.register("assetId")} />
                        <div className="space-y-1">
                          <Label htmlFor="assetValue">Value</Label>
                          <Input
                            id="assetValue"
                            {...assetValuationForm.register("value")}
                            disabled={!currentAssetId || assetValuationLoading}
                            placeholder="0"
                          />
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <div className="space-y-1">
                            <Label htmlFor="assetQuantity">Quantity</Label>
                            <Input
                              id="assetQuantity"
                              {...assetValuationForm.register("quantity")}
                              disabled={!currentAssetId || assetValuationLoading}
                              placeholder="Optional"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label htmlFor="assetAsOf">As of</Label>
                            <Input
                              id="assetAsOf"
                              type="date"
                              {...assetValuationForm.register("asOf")}
                              disabled={!currentAssetId || assetValuationLoading}
                            />
                          </div>
                        </div>
                        {assetValuationError && (
                          <p className="text-sm text-[var(--destructive)]">{assetValuationError}</p>
                        )}
                        <Button type="submit" disabled={!currentAssetId || assetValuationLoading}>
                          Save valuation
                        </Button>
                      </form>

                      {selectedAsset && (
                        <div className="overflow-x-auto">
                          <Table>
                            <TableHead>
                              <TableRow>
                                <TableHeaderCell>Date</TableHeaderCell>
                                <TableHeaderCell>Value</TableHeaderCell>
                                <TableHeaderCell>Quantity</TableHeaderCell>
                              </TableRow>
                            </TableHead>
                            <TableBody>
                              {selectedAsset.valuations.map((valuation) => (
                                <TableRow key={valuation.id}>
                                  <TableCell>{format(new Date(valuation.asOf), "MMM d, yyyy")}</TableCell>
                                  <TableCell>{formatCurrency(valuation.value, selectedAccount.currency)}</TableCell>
                                  <TableCell>{valuation.quantity ?? "—"}</TableCell>
                                </TableRow>
                              ))}
                              {selectedAsset.valuations.length === 0 && (
                                <TableRow>
                                  <TableCell colSpan={3} className="text-center text-sm text-[var(--muted-foreground)]">
                                    No valuations recorded yet for this asset.
                                  </TableCell>
                                </TableRow>
                              )}
                            </TableBody>
                          </Table>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Record transaction</CardTitle>
                </CardHeader>
                <CardContent>
                  <form className="grid gap-3 md:grid-cols-2" onSubmit={onSubmitTrade}>
                    <div className="space-y-1">
                      <Label htmlFor="tradeType">Type</Label>
                      <Select id="tradeType" {...tradeForm.register("type")}> 
                        <option value="BUY">Buy</option>
                        <option value="SELL">Sell</option>
                        <option value="DEPOSIT">Deposit</option>
                        <option value="WITHDRAW">Withdraw</option>
                        <option value="DIVIDEND">Dividend</option>
                        <option value="INTEREST">Interest</option>
                        <option value="FEE">Fee</option>
                        <option value="ADJUSTMENT">Adjustment</option>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="tradeOccurredAt">Date</Label>
                      <Input id="tradeOccurredAt" type="date" {...tradeForm.register("occurredAt")} />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="tradeAssetType">Asset type</Label>
                      <Select id="tradeAssetType" {...tradeForm.register("assetType")}> 
                        <option value="">Unspecified</option>
                        <option value="CRYPTO">Crypto</option>
                        <option value="EQUITY">Equity</option>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="tradeSymbol">Symbol</Label>
                      <Input id="tradeSymbol" {...tradeForm.register("symbol")} placeholder="BTC" />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="tradeQuantity">Quantity</Label>
                      <Input id="tradeQuantity" {...tradeForm.register("quantity")} placeholder="0.5" />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="tradePrice">Price per unit</Label>
                      <Input id="tradePrice" {...tradeForm.register("pricePerUnit")} placeholder="40000" />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="tradeAmount">Amount</Label>
                      <Input id="tradeAmount" {...tradeForm.register("amount")} placeholder="1000" />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="tradeFees">Fees</Label>
                      <Input id="tradeFees" {...tradeForm.register("fees")} placeholder="Optional" />
                    </div>
                    <div className="md:col-span-2 space-y-1">
                      <Label htmlFor="tradeNotes">Notes</Label>
                      <Textarea id="tradeNotes" rows={3} {...tradeForm.register("notes")} placeholder="Optional" />
                    </div>
                    {tradeError && (
                      <div className="md:col-span-2">
                        <p className="text-sm text-[var(--destructive)]">{tradeError}</p>
                      </div>
                    )}
                    <div className="md:col-span-2 flex justify-end">
                      <Button type="submit" disabled={tradeLoading}>
                        Save transaction
                      </Button>
                    </div>
                  </form>

                  <div className="mt-4 overflow-x-auto">
                    <Table>
                      <TableHead>
                        <TableRow>
                          <TableHeaderCell>Date</TableHeaderCell>
                          <TableHeaderCell>Type</TableHeaderCell>
                          <TableHeaderCell>Symbol</TableHeaderCell>
                          <TableHeaderCell>Amount</TableHeaderCell>
                          <TableHeaderCell>Notes</TableHeaderCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {selectedAccount.trades.map((trade) => (
                          <TableRow key={trade.id}>
                            <TableCell>{format(new Date(trade.occurredAt), "MMM d, yyyy")}</TableCell>
                            <TableCell>{trade.type}</TableCell>
                            <TableCell>{trade.symbol ?? "—"}</TableCell>
                            <TableCell>{formatCurrency(trade.amount, selectedAccount.currency)}</TableCell>
                            <TableCell>{trade.notes ?? ""}</TableCell>
                          </TableRow>
                        ))}
                        {selectedAccount.trades.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={5} className="text-center text-sm text-[var(--muted-foreground)]">
                              No transactions recorded yet.
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>Select an investment account</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-[var(--muted-foreground)]">
                  Choose an investment account to view holdings, valuations, and transactions.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <SidePanel
        open={accountDrawerOpen}
        title={accountDrawerMode === "edit" ? "Edit investment account" : "Add investment account"}
        description="Provide the account details for tracking in your dashboard."
        onClose={closeAccountDrawer}
      >
        <form className="space-y-4" onSubmit={onSubmitAccount}>
          <div className="space-y-1">
            <Label htmlFor="drawerName">Name</Label>
            <Input id="drawerName" {...accountForm.register("name")} placeholder="Brokerage account" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="drawerAssetClass">Primary holdings</Label>
            <Select id="drawerAssetClass" {...accountForm.register("assetClass")}> 
              <option value="CRYPTO">Crypto</option>
              <option value="EQUITY">Equity</option>
              <option value="MIXED">Mixed</option>
            </Select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="drawerKind">Account type</Label>
            <Select id="drawerKind" {...accountForm.register("kind")}> 
              <option value="BROKERAGE">Brokerage / Broker</option>
              <option value="WALLET">Wallet / Cold storage</option>
            </Select>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="drawerCurrency">Currency</Label>
              <Input id="drawerCurrency" {...accountForm.register("currency")} maxLength={3} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="drawerStatus">Status</Label>
              <Select id="drawerStatus" {...accountForm.register("status")}> 
                <option value="ACTIVE">Active</option>
                <option value="CLOSED">Closed</option>
                <option value="HIDDEN">Hidden</option>
              </Select>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="drawerOpeningBalance">Opening balance</Label>
              <Input id="drawerOpeningBalance" {...accountForm.register("openingBalance")} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="drawerInstitution">Institution</Label>
              <Input id="drawerInstitution" {...accountForm.register("institution")} placeholder="Optional" />
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="drawerNotes">Notes</Label>
            <Textarea id="drawerNotes" rows={3} {...accountForm.register("notes")} placeholder="Optional" />
          </div>
          {accountError && <p className="text-sm text-[var(--destructive)]">{accountError}</p>}
          <Button type="submit" disabled={accountLoading} className="w-full">
            {accountDrawerMode === "edit" ? "Save changes" : "Add account"}
          </Button>
        </form>
      </SidePanel>
    </div>
  );
}
