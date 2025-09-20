import { z } from "zod";

export const registerSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  email: z.string().email(),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(128),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1, "Password is required"),
});

export const accountSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, "Account name is required"),
  type: z.enum([
    "CHECKING",
    "SAVINGS",
    "CREDIT_CARD",
    "CASH",
    "INVESTMENT",
  ]),
  currency: z.string().min(3).max(3),
  openingBalance: z.coerce.number().int(),
  creditLimit: z.coerce.number().int().nullable(),
  status: z.enum(["ACTIVE", "CLOSED", "HIDDEN"]),
  institution: z.string().optional().nullable(),
  externalAccountId: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export const categorySchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, "Category name is required"),
  type: z.enum(["INCOME", "EXPENSE", "TRANSFER"]),
  color: z.string().optional().nullable(),
  icon: z.string().optional().nullable(),
  budgetLimit: z.coerce.number().int().nullable(),
});

export const transactionSchema = z.object({
  id: z.string().optional(),
  accountId: z.string().min(1, "Account is required"),
  date: z.coerce.date(),
  description: z.string().min(1, "Description is required"),
  amount: z.coerce.number().int(),
  merchant: z.string().optional().nullable(),
  memo: z.string().optional().nullable(),
  status: z.enum(["PENDING", "CLEARED", "RECONCILED"]),
  reference: z.string().optional().nullable(),
  importTag: z.string().optional().nullable(),
  splits: z
    .array(
      z.object({
        categoryId: z.string(),
        amount: z.coerce.number().int(),
      })
    )
    .optional(),
});

export const csvImportConfigSchema = z.object({
  accountId: z.string().min(1),
  templateId: z.string().optional(),
  mappings: z.object({
    date: z.string(),
    description: z.string(),
    amount: z.string(),
    reference: z.string().optional(),
    merchant: z.string().optional(),
  }),
  duplicates: z.array(
    z.object({
      date: z.coerce.date(),
      amount: z.coerce.number().int(),
      description: z.string(),
    })
  ),
});

export const importRowSchema = z.object({
  date: z.string(),
  description: z.string().min(1),
  amount: z.number().int(),
  merchant: z.string().optional().nullable(),
  reference: z.string().optional().nullable(),
  categoryId: z.string().optional().nullable(),
});

export const importPayloadSchema = z.object({
  accountId: z.string().min(1),
  rows: z.array(importRowSchema).min(1),
  template: z
    .object({
      name: z.string().min(1),
      mappings: z.object({
        date: z.string(),
        description: z.string(),
        amount: z.string(),
        merchant: z.string().optional(),
        reference: z.string().optional(),
        dateFormat: z.string().optional(),
      }),
    })
    .optional(),
});

export const dateRangeSchema = z.object({
  from: z.date().optional(),
  to: z.date().optional(),
});

export const transferSchema = z.object({
  fromAccountId: z.string().min(1, "From account is required"),
  toAccountId: z.string().min(1, "To account is required"),
  date: z.coerce.date(),
  amount: z.coerce.number().int().positive("Amount must be greater than zero"),
  description: z.string().min(1, "Description is required"),
  memo: z.string().optional().nullable(),
});

export const transactionRuleSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, "Rule name is required"),
  categoryId: z.string().min(1, "Category is required"),
  accountId: z.string().optional().nullable(),
  descriptionStartsWith: z.string().optional().nullable(),
  descriptionContains: z.string().optional().nullable(),
  amountEquals: z.string().optional().nullable(),
  priority: z.coerce.number().int().min(1).max(999).optional(),
});
