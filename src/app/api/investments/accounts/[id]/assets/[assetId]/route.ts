import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedUser, unauthorizedResponse } from "@/lib/auth-helpers";
import { investmentAssetSchema } from "@/lib/validators";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string; assetId: string }> }
) {
  const { id, assetId } = await params;
  const user = await getAuthenticatedUser();
  if (!user?.id) {
    return unauthorizedResponse();
  }

  const asset = await prisma.investmentAsset.findUnique({
    where: { id: assetId },
    include: {
      account: {
        select: { id: true, userId: true },
      },
    },
  });

  if (!asset || asset.account.id !== id || asset.userId !== user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await request.json();
  const parsed = investmentAssetSchema.safeParse({
    ...body,
    id: assetId,
    investmentAccountId: id,
  });

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const updated = await prisma.investmentAsset.update({
    where: { id: assetId },
    data: {
      name: parsed.data.name,
      symbol: parsed.data.symbol?.trim() || null,
      type: parsed.data.type,
    },
  });

  return NextResponse.json({
    id: updated.id,
    name: updated.name,
    symbol: updated.symbol,
    type: updated.type,
    createdAt: updated.createdAt.toISOString(),
  });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; assetId: string }> }
) {
  const { id, assetId } = await params;
  const user = await getAuthenticatedUser();
  if (!user?.id) {
    return unauthorizedResponse();
  }

  const asset = await prisma.investmentAsset.findUnique({
    where: { id: assetId },
    include: {
      account: {
        select: { id: true, userId: true },
      },
    },
  });

  if (!asset || asset.account.id !== id || asset.userId !== user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.investmentAsset.delete({ where: { id: assetId } });

  return NextResponse.json({ success: true });
}
