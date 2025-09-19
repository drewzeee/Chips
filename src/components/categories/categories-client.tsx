"use client";

import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { categorySchema } from "@/lib/validators";
import { parseAmountToCents, formatCurrency } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Label } from "@/components/ui/label";

const CATEGORY_TYPES = [
  { value: "INCOME", label: "Income" },
  { value: "EXPENSE", label: "Expense" },
  { value: "TRANSFER", label: "Transfer" },
];

const formSchema = categorySchema.omit({ id: true }).extend({
  budgetLimit: z.string().optional().nullable(),
});

type FormValues = z.infer<typeof formSchema>;

export interface CategoryItem {
  id: string;
  name: string;
  type: "INCOME" | "EXPENSE" | "TRANSFER";
  color: string | null;
  icon: string | null;
  parentId: string | null;
  budgetLimit: number | null;
  createdAt: string;
}

export function CategoriesClient({ initialCategories }: { initialCategories: CategoryItem[] }) {
  const [categories, setCategories] = useState(initialCategories);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [filterType, setFilterType] = useState<"ALL" | CategoryItem["type"]>("ALL");

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      type: "EXPENSE",
      color: "",
      icon: "",
      parentId: "",
      budgetLimit: "",
    },
  });

  const filteredCategories = useMemo(() => {
    return filterType === "ALL"
      ? categories
      : categories.filter((category) => category.type === filterType);
  }, [categories, filterType]);

  const watchType = form.watch("type");

  const parentOptions = useMemo(() => {
    return categories.filter((category) => category.type === watchType);
  }, [categories, watchType]);

  const resetForm = () => {
    setSelectedId(null);
    form.reset({ name: "", type: "EXPENSE", color: "", icon: "", parentId: "", budgetLimit: "" });
  };

  const handleEdit = (category: CategoryItem) => {
    setSelectedId(category.id);
    form.reset({
      name: category.name,
      type: category.type,
      color: category.color ?? "",
      icon: category.icon ?? "",
      parentId: category.parentId ?? "",
      budgetLimit: category.budgetLimit ? (category.budgetLimit / 100).toString() : "",
    });
  };

  const onSubmit = form.handleSubmit(async (values) => {
    setError(null);
    setLoading(true);

    const payload = {
      name: values.name,
      type: values.type,
      color: values.color || null,
      icon: values.icon || null,
      parentId: values.parentId || null,
      budgetLimit: values.budgetLimit ? parseAmountToCents(values.budgetLimit) : null,
    };

    try {
      const response = await fetch(selectedId ? `/api/categories/${selectedId}` : "/api/categories", {
        method: selectedId ? "PUT" : "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const json = await response.json().catch(() => null);
        throw new Error(json?.error ?? "Unable to save category");
      }

      const category: CategoryItem = await response.json();
      setCategories((prev) => {
        if (selectedId) {
          return prev.map((item) => (item.id === selectedId ? category : item));
        }
        return [...prev, category];
      });
      resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected error");
    } finally {
      setLoading(false);
    }
  });

  const handleDelete = async (id: string) => {
    if (!window.confirm("Delete this category? Transactions assigned to it will be affected.")) {
      return;
    }
    setLoading(true);
    try {
      const response = await fetch(`/api/categories/${id}`, { method: "DELETE" });
      if (!response.ok) {
        const json = await response.json().catch(() => null);
        throw new Error(json?.error ?? "Unable to delete category");
      }
      setCategories((prev) => prev.filter((category) => category.id !== id));
      if (selectedId === id) {
        resetForm();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected error");
    } finally {
      setLoading(false);
    }
  };

  const totals = useMemo(() => {
    const expenseBudget = categories
      .filter((category) => category.type === "EXPENSE" && category.budgetLimit)
      .reduce((sum, category) => sum + (category.budgetLimit ?? 0), 0);
    return {
      expenseBudget,
      incomeCategories: categories.filter((category) => category.type === "INCOME").length,
      expenseCategories: categories.filter((category) => category.type === "EXPENSE").length,
    };
  }, [categories]);

  return (
    <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
      <div className="space-y-4">
        <Card>
          <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle>Categories</CardTitle>
            <Select
              value={filterType}
              onChange={(event) =>
                setFilterType(event.target.value as "ALL" | CategoryItem["type"])
              }
            >
              <option value="ALL">All types</option>
              {CATEGORY_TYPES.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </Select>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHead>
                <TableRow>
                  <TableHeaderCell>Name</TableHeaderCell>
                  <TableHeaderCell>Type</TableHeaderCell>
                  <TableHeaderCell>Parent</TableHeaderCell>
                  <TableHeaderCell className="text-right">Budget</TableHeaderCell>
                  <TableHeaderCell></TableHeaderCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredCategories.map((category) => (
                  <TableRow key={category.id}>
                    <TableCell className="font-medium">
                      <span
                        className="mr-2 inline-block h-3 w-3 rounded-full"
                        style={{ background: category.color ?? "#CBD5F5" }}
                      />
                      {category.name}
                    </TableCell>
                    <TableCell>{category.type}</TableCell>
                    <TableCell>
                      {category.parentId
                        ? categories.find((item) => item.id === category.parentId)?.name ?? ""
                        : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      {category.budgetLimit ? formatCurrency(category.budgetLimit) : "—"}
                    </TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button variant="ghost" size="sm" onClick={() => handleEdit(category)}>
                        Edit
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-red-600 hover:text-red-700 dark:text-rose-300 dark:hover:text-rose-200"
                        onClick={() => handleDelete(category.id)}
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
            <CardTitle>{selectedId ? "Edit category" : "Add category"}</CardTitle>
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
                  {CATEGORY_TYPES.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="flex gap-4">
                <div className="space-y-2">
                  <Label htmlFor="color">Color</Label>
                  <Input id="color" placeholder="#2563eb" {...form.register("color")} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="icon">Icon</Label>
                  <Input id="icon" placeholder="Optional emoji or text" {...form.register("icon")} />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="parentId">Parent category</Label>
                <Select id="parentId" {...form.register("parentId")}>
                  <option value="">None</option>
                  {parentOptions
                    .filter((category) => category.id !== selectedId)
                    .map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.name}
                      </option>
                    ))}
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="budgetLimit">Budget (per month)</Label>
                <Input id="budgetLimit" placeholder="Optional" {...form.register("budgetLimit")} />
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <div className="flex items-center gap-2">
                <Button type="submit" disabled={loading}>
                  {loading ? "Saving..." : selectedId ? "Save changes" : "Create category"}
                </Button>
                {selectedId && (
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
            <CardTitle>At a glance</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Income categories</span>
              <span className="font-semibold">{totals.incomeCategories}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Expense categories</span>
              <span className="font-semibold">{totals.expenseCategories}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Budgeted spend</span>
              <span className="font-semibold">{formatCurrency(totals.expenseBudget)}</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
