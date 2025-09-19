import { prisma } from "@/lib/prisma";
import { getAuthSession } from "@/lib/auth";
import { ImportClient, ImportTemplate } from "@/components/import/import-client";

export default async function ImportPage() {
  const session = await getAuthSession();
  const userId = session?.user?.id;

  if (!userId) {
    return null;
  }

  const [accounts, categories, templates] = await Promise.all([
    prisma.financialAccount.findMany({
      where: { userId },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        currency: true,
      },
    }),
    prisma.category.findMany({
      where: { userId },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        type: true,
      },
    }),
    prisma.importTemplate.findMany({
      where: { userId },
      orderBy: { updatedAt: "desc" },
    }),
  ]);

  const templatePayload = templates.map((template) => {
    let raw: Partial<ImportTemplate["mappings"]> = {};
    try {
      raw = JSON.parse(template.mappings) as Partial<ImportTemplate["mappings"]>;
    } catch (error) {
      console.error("Failed to parse template mappings", error);
    }
    return {
      id: template.id,
      name: template.name,
      mappings: {
        date: raw.date ?? "",
        description: raw.description ?? "",
        amount: raw.amount ?? "",
        merchant: raw.merchant,
        reference: raw.reference,
        dateFormat: raw.dateFormat,
      },
    } satisfies ImportTemplate;
  });

  return (
    <ImportClient
      accounts={accounts}
      categories={categories}
      templates={templatePayload}
    />
  );
}
