import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedUser, unauthorizedResponse } from "@/lib/auth-helpers";
import { markTransactionsAsTransfer } from "../utils";

const BAD_REQUEST = NextResponse.json({ error: "Invalid request" }, { status: 400 });

export async function POST(request: Request) {
  const user = await getAuthenticatedUser();
  if (!user?.id) {
    return unauthorizedResponse();
  }

  const json = await request.json().catch(() => null);
  if (!json || typeof json !== "object") {
    return BAD_REQUEST;
  }

  const { transactionId, counterpartTransactionId } = json as {
    transactionId?: string;
    counterpartTransactionId?: string;
  };

  if (!transactionId || !counterpartTransactionId || transactionId === counterpartTransactionId) {
    return BAD_REQUEST;
  }

  const [transactionA, transactionB] = await Promise.all([
    prisma.transaction.findUnique({
      where: { id: transactionId },
      include: { account: true },
    }),
    prisma.transaction.findUnique({
      where: { id: counterpartTransactionId },
      include: { account: true },
    }),
  ]);

  if (!transactionA || !transactionB) {
    return NextResponse.json({ error: "Transactions not found" }, { status: 404 });
  }

  if (transactionA.userId !== user.id || transactionB.userId !== user.id) {
    return unauthorizedResponse();
  }

  if (transactionA.accountId === transactionB.accountId) {
    return NextResponse.json({ error: "Transfers must span two different accounts" }, { status: 400 });
  }

  await markTransactionsAsTransfer({
    transactionA,
    transactionB,
  });

  const [updatedA, updatedB] = await Promise.all([
    prisma.transaction.findUnique({
      where: { id: transactionA.id },
      include: {
        account: true,
        splits: { include: { category: true } },
      },
    }),
    prisma.transaction.findUnique({
      where: { id: transactionB.id },
      include: {
        account: true,
        splits: { include: { category: true } },
      },
    }),
  ]);

  return NextResponse.json({ primary: updatedA, counterpart: updatedB });
}
