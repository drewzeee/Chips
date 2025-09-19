import { NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { registerSchema } from "@/lib/validators";

const DEFAULT_CATEGORIES = [
  { name: "Income", type: "INCOME" },
  { name: "Salary", type: "INCOME", parent: "Income" },
  { name: "Bonus", type: "INCOME", parent: "Income" },
  { name: "Expenses", type: "EXPENSE" },
  { name: "Housing", type: "EXPENSE", parent: "Expenses" },
  { name: "Utilities", type: "EXPENSE", parent: "Expenses" },
  { name: "Groceries", type: "EXPENSE", parent: "Expenses" },
  { name: "Transportation", type: "EXPENSE", parent: "Expenses" },
  { name: "Entertainment", type: "EXPENSE", parent: "Expenses" },
  { name: "Healthcare", type: "EXPENSE", parent: "Expenses" },
  { name: "Insurance", type: "EXPENSE", parent: "Expenses" },
  { name: "Education", type: "EXPENSE", parent: "Expenses" },
  { name: "Travel", type: "EXPENSE", parent: "Expenses" },
  { name: "Miscellaneous", type: "EXPENSE", parent: "Expenses" },
];

export async function POST(request: Request) {
  try {
    const json = await request.json();
    const parsed = registerSchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { email, name, password } = parsed.data;
    const normalizedEmail = email.toLowerCase();

    const existing = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (existing) {
      return NextResponse.json(
        { error: { email: ["Email already in use"] } },
        { status: 409 }
      );
    }

    const hashedPassword = await hash(password, 12);

    const user = await prisma.user.create({
      data: {
        email: normalizedEmail,
        name,
        password: hashedPassword,
      },
    });

    const categoryMap = new Map<string, string>();

    for (const category of DEFAULT_CATEGORIES) {
      const parentId = category.parent
        ? categoryMap.get(category.parent)
        : undefined;

      const created = await prisma.category.create({
        data: {
          name: category.name,
          type: category.type as "INCOME" | "EXPENSE",
          userId: user.id,
          parentId,
        },
      });

      categoryMap.set(category.name, created.id);
    }

    await prisma.financialAccount.createMany({
      data: [
        {
          userId: user.id,
          name: "Checking",
          type: "CHECKING",
          currency: "USD",
          openingBalance: 0,
          status: "ACTIVE",
        },
        {
          userId: user.id,
          name: "Cash",
          type: "CASH",
          currency: "USD",
          openingBalance: 0,
          status: "ACTIVE",
        },
      ],
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Register error", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
