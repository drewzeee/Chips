import { prisma } from "@/lib/prisma";
import { getAuthSession } from "@/lib/auth";
import { CategoriesClient, CategoryItem } from "@/components/categories/categories-client";

export default async function CategoriesPage() {
  const session = await getAuthSession();
  const userId = session?.user?.id;

  if (!userId) {
    return null;
  }

  const categories = await prisma.category.findMany({
    where: { userId },
    orderBy: [{ type: "asc" }, { name: "asc" }],
  });

  const payload: CategoryItem[] = categories.map((category) => ({
    id: category.id,
    name: category.name,
    type: category.type,
    color: category.color,
    icon: category.icon,
    budgetLimit: category.budgetLimit ?? null,
    createdAt: category.createdAt.toISOString(),
  }));

  return <CategoriesClient initialCategories={payload} />;
}
