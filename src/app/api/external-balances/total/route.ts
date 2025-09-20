import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { getTotalExternalBalanceUSD } from "@/lib/balance-snapshots";

export async function GET(request: NextRequest) {
  try {
    const session = await getAuthSession();

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const totalUSD = await getTotalExternalBalanceUSD(session.user.id);

    return NextResponse.json({ totalUSD });
  } catch (error) {
    console.error("External balance total error:", error);
    return NextResponse.json(
      { error: "Failed to fetch external balance total" },
      { status: 500 }
    );
  }
}