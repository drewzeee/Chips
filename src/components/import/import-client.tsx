"use client";

import Papa from "papaparse";
import { useMemo, useState } from "react";
import { parse } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from "@/components/ui/table";
import { formatCurrency, parseAmountToCents } from "@/lib/utils";

export interface ImportAccount {
  id: string;
  name: string;
  currency: string;
}

export interface ImportCategory {
  id: string;
  name: string;
  type: "INCOME" | "EXPENSE" | "TRANSFER";
}

export interface ImportTemplate {
  id: string;
  name: string;
  mappings: {
    date: string;
    description: string;
    amount: string;
    merchant?: string;
    reference?: string;
    dateFormat?: string;
  };
}

type Step = 1 | 2 | 3 | 4;

interface PreparedRow {
  date: string;
  description: string;
  amount: number;
  merchant?: string | null;
  reference?: string | null;
  categoryId?: string | null;
}

const REQUIRED_FIELDS = ["date", "description", "amount"] as const;

type ColumnMapping = {
  date: string;
  description: string;
  amount: string;
  merchant?: string;
  reference?: string;
};

export function ImportClient({
  accounts,
  categories,
  templates,
}: {
  accounts: ImportAccount[];
  categories: ImportCategory[];
  templates: ImportTemplate[];
}) {
  const [step, setStep] = useState<Step>(1);
  const [fileName, setFileName] = useState<string>("");
  const [rawRows, setRawRows] = useState<Record<string, string>[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [mapping, setMapping] = useState<ColumnMapping>({
    date: "",
    description: "",
    amount: "",
    merchant: "",
    reference: "",
  });
  const [dateFormat, setDateFormat] = useState("yyyy-MM-dd");
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? "");
  const [defaultCategoryId, setDefaultCategoryId] = useState<string>("");
  const [templateName, setTemplateName] = useState("");
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [preparedRows, setPreparedRows] = useState<PreparedRow[]>([]);
  const [previewStats, setPreviewStats] = useState<{ total: number; duplicates: number; importable: number } | null>(
    null
  );
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
        const data = results.data.filter((row) => Object.values(row).some((value) => value && value.trim() !== ""));
        setRawRows(data.slice(0, 500));
        setColumns(Object.keys(data[0] ?? {}));
        setStep(2);
      },
      error: (papError) => {
        setError(`Failed to parse CSV: ${papError.message}`);
      },
    });
  };

  const applyTemplate = (templateId: string) => {
    setSelectedTemplateId(templateId);
    const template = templates.find((item) => item.id === templateId);
    if (template) {
      setMapping({
        date: template.mappings.date ?? "",
        description: template.mappings.description ?? "",
        amount: template.mappings.amount ?? "",
        merchant: template.mappings.merchant ?? "",
        reference: template.mappings.reference ?? "",
      });
      setDateFormat(template.mappings.dateFormat ?? "yyyy-MM-dd");
      setTemplateName(template.name);
    }
  };

  const prepareData = () => {
    setError(null);

    for (const field of REQUIRED_FIELDS) {
      if (!mapping[field]) {
        setError(`Please map the ${field} column before continuing.`);
        return null;
      }
    }

    const rows: PreparedRow[] = [];
    for (const row of rawRows) {
      const dateInput = row[mapping.date];
      const description = row[mapping.description]?.trim();
      const amountInput = row[mapping.amount];

      if (!dateInput || !description || !amountInput) {
        continue;
      }

      let parsedDate = new Date(dateInput);
      if (Number.isNaN(parsedDate.getTime()) && dateFormat) {
        parsedDate = parse(dateInput, dateFormat, new Date());
      }

      if (Number.isNaN(parsedDate.getTime())) {
        continue;
      }

      const amount = parseAmountToCents(amountInput);
      if (!Number.isFinite(amount) || amount === 0) {
        continue;
      }

      rows.push({
        date: parsedDate.toISOString(),
        description,
        amount,
        merchant: mapping.merchant ? row[mapping.merchant] ?? null : null,
        reference: mapping.reference ? row[mapping.reference] ?? null : null,
        categoryId: defaultCategoryId || null,
      });
    }

    if (rows.length === 0) {
      setError("No valid rows detected. Check your mappings and try again.");
      return null;
    }

    setPreparedRows(rows);
    return rows;
  };

  const runPreview = async () => {
    const rows = prepareData();
    if (!rows) return;

    setLoading(true);
    setError(null);
    setPreviewStats(null);

    try {
      const response = await fetch(`/api/import?dryRun=true`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountId,
          rows,
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error ?? "Unable to preview import");
      }

      const result = await response.json();
      setPreviewStats(result);
      setStep(4);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected error");
    } finally {
      setLoading(false);
    }
  };

  const commitImport = async () => {
    if (preparedRows.length === 0) {
      setError("Nothing to import. Run preview first.");
      return;
    }

    setLoading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const payload: Record<string, unknown> = {
        accountId,
        rows: preparedRows,
      };

      if (templateName.trim()) {
        payload.template = {
          name: templateName.trim(),
          mappings: {
            ...mapping,
            dateFormat,
          },
        };
      }

      const response = await fetch(`/api/import`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const payloadJson = await response.json().catch(() => null);
        throw new Error(payloadJson?.error ?? "Import failed");
      }

      const result = await response.json();
      setSuccessMessage(`Imported ${result.imported} transactions. ${result.duplicates} duplicates skipped.`);
      setStep(1);
      setPreparedRows([]);
      setPreviewStats(null);
      setFileName("");
      setRawRows([]);
      setColumns([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected error");
    } finally {
      setLoading(false);
    }
  };

  const samplePreview = useMemo(() => rawRows.slice(0, 5), [rawRows]);

  const currentStepTitle = {
    1: "Upload CSV",
    2: "Map Columns",
    3: "Preview & Validate",
    4: "Import Summary",
  }[step];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{currentStepTitle}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {step === 1 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="account">Target account</Label>
                <Select id="account" value={accountId} onChange={(event) => setAccountId(event.target.value)}>
                  {accounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.name}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="template">Saved template</Label>
                <Select
                  id="template"
                  value={selectedTemplateId}
                  onChange={(event) => applyTemplate(event.target.value)}
                >
                  <option value="">None</option>
                  {templates.map((template) => (
                    <option key={template.id} value={template.id}>
                      {template.name}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="file">CSV file</Label>
                <Input id="file" type="file" accept=".csv" onChange={handleFileChange} />
                {fileName && <p className="text-sm text-gray-500">Selected: {fileName}</p>}
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="dateFormat">Date format</Label>
                <Input
                  id="dateFormat"
                  value={dateFormat}
                  onChange={(event) => setDateFormat(event.target.value)}
                  placeholder="yyyy-MM-dd"
                />
                <p className="text-xs text-gray-500">Use date-fns tokens (e.g. MM/dd/yyyy).</p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                {(Object.keys(mapping) as (keyof ColumnMapping)[]).map((field) => {
                  const isRequired =
                    field === "date" || field === "description" || field === "amount";
                  return (
                    <div key={field} className="space-y-2">
                      <Label className={isRequired ? "font-semibold" : ""}>
                        {field.charAt(0).toUpperCase() + field.slice(1)}
                      </Label>
                      <Select
                        value={mapping[field] ?? ""}
                        onChange={(event) =>
                          setMapping((prev) => ({ ...prev, [field]: event.target.value }))
                        }
                      >
                        <option value="">Not mapped</option>
                        {columns.map((column) => (
                          <option key={`${field}-${column}`} value={column}>
                            {column}
                          </option>
                        ))}
                      </Select>
                    </div>
                  );
                })}
              </div>
              <div className="space-y-2">
                <Label>Sample rows</Label>
                <Table>
                  <TableHead>
                    <TableRow>
                      {columns.slice(0, 6).map((column) => (
                        <TableHeaderCell key={column}>{column}</TableHeaderCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {samplePreview.map((row, rowIndex) => (
                      <TableRow key={`preview-${rowIndex}`}>
                        {columns.slice(0, 6).map((column) => (
                          <TableCell key={`${rowIndex}-${column}`}>{row[column]}</TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="flex items-center justify-between">
                <Button variant="secondary" onClick={() => setStep(1)}>
                  Back
                </Button>
                <Button onClick={() => setStep(3)}>Continue</Button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="defaultCategory">Default category</Label>
                <Select
                  id="defaultCategory"
                  value={defaultCategoryId}
                  onChange={(event) => setDefaultCategoryId(event.target.value)}
                >
                  <option value="">None</option>
                  {categories
                    .filter((category) => category.type === "EXPENSE" || category.type === "INCOME")
                    .map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="templateName">Save as template</Label>
                <Input
                  id="templateName"
                  placeholder="Optional template name"
                  value={templateName}
                  onChange={(event) => setTemplateName(event.target.value)}
                />
                <p className="text-xs text-gray-500">
                  Provide a name to reuse this column mapping for future imports.
                </p>
              </div>
              <div className="flex items-center justify-between">
                <Button variant="secondary" onClick={() => setStep(2)}>
                  Back
                </Button>
                <Button onClick={runPreview} disabled={loading}>
                  {loading ? "Checking..." : "Run preview"}
                </Button>
              </div>
            </div>
          )}

          {step === 4 && previewStats && (
            <div className="space-y-6">
              <div>
                <p className="text-lg font-semibold text-gray-900">Preview summary</p>
                <ul className="mt-2 space-y-1 text-sm text-gray-600">
                  <li>Total rows analyzed: {previewStats.total}</li>
                  <li>Potential duplicates: {previewStats.duplicates}</li>
                  <li>Ready to import: {previewStats.importable}</li>
                </ul>
              </div>
              <div className="space-y-2">
                <Label>First 5 transactions</Label>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableHeaderCell>Date</TableHeaderCell>
                      <TableHeaderCell>Description</TableHeaderCell>
                      <TableHeaderCell className="text-right">Amount</TableHeaderCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {preparedRows.slice(0, 5).map((row, index) => (
                      <TableRow key={`prepared-${index}`}>
                        <TableCell>{new Date(row.date).toLocaleDateString()}</TableCell>
                        <TableCell>{row.description}</TableCell>
                        <TableCell className="text-right font-semibold">
                          {formatCurrency(row.amount)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="flex items-center justify-between">
                <Button variant="secondary" onClick={() => setStep(3)}>
                  Back
                </Button>
                <Button onClick={commitImport} disabled={loading}>
                  {loading ? "Importing..." : "Import transactions"}
                </Button>
              </div>
            </div>
          )}

          {error && <p className="text-sm text-red-600">{error}</p>}
          {successMessage && <p className="text-sm text-green-600">{successMessage}</p>}
        </CardContent>
      </Card>
    </div>
  );
}
