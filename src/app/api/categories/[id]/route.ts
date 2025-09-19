import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { categorySchema } from "@/lib/validators";
import { getAuthenticatedUser, unauthorizedResponse } from "@/lib/auth-helpers";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const user = await getAuthenticatedUser();
  if (!user?.id) {
    return unauthorizedResponse();
  }

  const existing = await prisma.category.findUnique({ where: { id } });
  if (!existing || existing.userId !== user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await request.json();
  const parsed = categorySchema.safeParse({ ...body, id });

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  if (parsed.data.parentId) {
    if (parsed.data.parentId === id) {
      return NextResponse.json({ error: "Category cannot be its own parent" }, { status: 400 });
    }
    const parent = await prisma.category.findUnique({ where: { id: parsed.data.parentId } });
    if (!parent || parent.userId !== user.id) {
      return NextResponse.json({ error: "Invalid parent category" }, { status: 400 });
    }
  }

  const updated = await prisma.category.update({
    where: { id },
    data: {
      name: parsed.data.name,
      type: parsed.data.type,
      color: parsed.data.color ?? null,
      icon: parsed.data.icon ?? null,
      parentId: parsed.data.parentId ?? null,
      budgetLimit: parsed.data.budgetLimit ?? null,
    },
  });

  return NextResponse.json(updated);
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const user = await getAuthenticatedUser();
  if (!user?.id) {
    return unauthorizedResponse();
  }

  const existing = await prisma.category.findUnique({ where: { id } });
  if (!existing || existing.userId !== user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const splitCount = await prisma.transactionSplit.count({
    where: { categoryId: id, userId: user.id },
  });

  if (splitCount > 0) {
    return NextResponse.json(
      { error: "Category is in use and cannot be deleted" },
      { status: 400 }
    );
  }

  await prisma.category.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
