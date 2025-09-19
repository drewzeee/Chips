import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedUser, unauthorizedResponse } from "@/lib/auth-helpers";
import { findTransferCandidates } from "../../utils";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const user = await getAuthenticatedUser();
  if (!user?.id) {
    return unauthorizedResponse();
  }

  const transaction = await prisma.transaction.findUnique({
    where: { id },
    include: {
      account: true,
    },
  });

  if (!transaction || transaction.userId !== user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const candidates = await findTransferCandidates(
    {
      userId: user.id,
      account: transaction.account,
      transaction,
      existingReference: transaction.reference,
    },
    10
  );

  return NextResponse.json(
    candidates.map((candidate) => ({
      transaction: {
        id: candidate.transaction.id,
        date: candidate.transaction.date,
        description: candidate.transaction.description,
        amount: candidate.transaction.amount,
        status: candidate.transaction.status,
        accountId: candidate.transaction.accountId,
        memo: candidate.transaction.memo,
        reference: candidate.transaction.reference,
      },
      account: {
        id: candidate.account.id,
        name: candidate.account.name,
        type: candidate.account.type,
        currency: candidate.account.currency,
      },
      confidence: candidate.confidence,
    }))
  );
}
