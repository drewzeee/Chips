import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { categorySchema } from "@/lib/validators";
import { getAuthenticatedUser, unauthorizedResponse } from "@/lib/auth-helpers";

export async function GET() {
  const user = await getAuthenticatedUser();
  if (!user?.id) {
    return unauthorizedResponse();
  }

  const categories = await prisma.category.findMany({
    where: { userId: user.id },
    orderBy: [{ type: "asc" }, { name: "asc" }],
  });

  return NextResponse.json(categories);
}

export async function POST(request: Request) {
  const user = await getAuthenticatedUser();
  if (!user?.id) {
    return unauthorizedResponse();
  }

  const body = await request.json();
  const parsed = categorySchema.omit({ id: true }).safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const category = await prisma.category.create({
    data: {
      userId: user.id,
      name: parsed.data.name,
      type: parsed.data.type,
      color: parsed.data.color ?? null,
      icon: parsed.data.icon ?? null,
      budgetLimit: parsed.data.budgetLimit ?? null,
    },
  });

  return NextResponse.json(category, { status: 201 });
}
