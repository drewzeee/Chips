import { prisma } from "@/lib/prisma";
import { getAuthSession } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { format } from "date-fns";
import { RulesManager } from "@/components/settings/rules-manager";
import { ClearTransactionsButton } from "@/components/settings/clear-transactions-button";
import { DatabaseManagement } from "@/components/settings/database-management";

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
          <CardContent className="space-y-4 text-sm text-[var(--muted-foreground)]">
            <div className="space-y-1">
              <p className="text-xs uppercase tracking-wide text-[color:color-mix(in_srgb,var(--muted-foreground)_75%,transparent)]">
                Name
              </p>
              <p className="font-medium text-[var(--foreground)]">{user?.name ?? "Not provided"}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs uppercase tracking-wide text-[color:color-mix(in_srgb,var(--muted-foreground)_75%,transparent)]">
                Email
              </p>
              <p className="font-medium text-[var(--foreground)]">{user?.email}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs uppercase tracking-wide text-[color:color-mix(in_srgb,var(--muted-foreground)_75%,transparent)]">
                Member since
              </p>
              <p className="font-medium text-[var(--foreground)]">
                {user?.createdAt ? format(user.createdAt, "MMMM d, yyyy") : "—"}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Import templates</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-[var(--muted-foreground)]">
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
                <div
                  key={template.id}
                  className="rounded-xl border border-[var(--border)] bg-[color:color-mix(in_srgb,var(--card)_75%,var(--background)_25%)] p-4 shadow-sm"
                >
                  <p className="font-medium text-[var(--card-foreground)]">{template.name}</p>
                  <p className="text-xs text-[color:color-mix(in_srgb,var(--muted-foreground)_80%,transparent)]">
                    Updated {format(template.updatedAt, "MMM d, yyyy")}
                  </p>
                  <p className="text-xs text-[var(--muted-foreground)]">{mappingPreview}</p>
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

      <Card>
        <CardHeader>
          <CardTitle>Database Management</CardTitle>
        </CardHeader>
        <CardContent>
          <DatabaseManagement />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Danger zone</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-[var(--muted-foreground)]">
          <p>
            Remove every transaction you have recorded. This action can&rsquo;t be undone and may
            impact reports, budgets, and account balances.
          </p>
          <ClearTransactionsButton />
        </CardContent>
      </Card>
    </div>
  );
}
