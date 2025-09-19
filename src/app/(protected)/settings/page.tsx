import { prisma } from "@/lib/prisma";
import { getAuthSession } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { format } from "date-fns";
import { RulesManager } from "@/components/settings/rules-manager";

export default async function SettingsPage() {
  const session = await getAuthSession();
  const userId = session?.user?.id;

  if (!userId) {
    return null;
  }

  const [user, templates, rules, accounts, categories] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, name: true, createdAt: true },
    }),
    prisma.importTemplate.findMany({
      where: { userId },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.transactionRule.findMany({
      where: { userId },
      include: {
        category: {
          select: { id: true, name: true, type: true },
        },
        account: {
          select: { id: true, name: true, currency: true },
        },
      },
      orderBy: { priority: "asc" },
    }),
    prisma.financialAccount.findMany({
      where: { userId },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.category.findMany({
      where: { userId },
      select: { id: true, name: true, type: true },
      orderBy: [{ type: "asc" }, { name: "asc" }],
    }),
  ]);

  const categoryOptions = categories
    .filter((category) => category.type !== "TRANSFER")
    .map((category) => ({ id: category.id, name: category.name, type: category.type }));
  const accountOptions = accounts.map((account) => ({ id: account.id, name: account.name }));

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Profile</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-gray-600">
            <div>
              <p className="text-xs uppercase text-gray-400">Name</p>
              <p className="font-medium text-gray-900">{user?.name ?? "Not provided"}</p>
            </div>
            <div>
              <p className="text-xs uppercase text-gray-400">Email</p>
              <p className="font-medium text-gray-900">{user?.email}</p>
            </div>
            <div>
              <p className="text-xs uppercase text-gray-400">Member since</p>
              <p className="font-medium text-gray-900">
                {user?.createdAt ? format(user.createdAt, "MMMM d, yyyy") : "—"}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Import templates</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-gray-600">
            {templates.length === 0 && <p>No saved templates yet.</p>}
            {templates.map((template) => {
              let mappingPreview = "";
              try {
                const data = JSON.parse(template.mappings) as Record<string, string>;
                mappingPreview = `${data.date ?? "date"} → ${data.description ?? "description"}, amount: ${data.amount ?? ""}`;
              } catch {
                mappingPreview = "Unreadable mapping";
              }
              return (
                <div key={template.id} className="rounded-lg border border-gray-200 p-3">
                  <p className="font-medium text-gray-900">{template.name}</p>
                  <p className="text-xs text-gray-500">Updated {format(template.updatedAt, "MMM d, yyyy")}</p>
                  <p className="text-xs text-gray-600">{mappingPreview}</p>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>

      <RulesManager
        initialRules={rules}
        categories={categoryOptions}
        accounts={accountOptions}
      />
    </div>
  );
}
