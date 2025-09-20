import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { fetchGeminiBalances } from "@/lib/integrations/gemini";
import { convertBalancesToUSD } from "@/lib/crypto-prices";
import { saveExternalBalanceSnapshots } from "@/lib/balance-snapshots";

export async function GET(request: NextRequest) {
  try {
    const session = await getAuthSession();

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const balances = await fetchGeminiBalances();

    // Filter out zero balances and format for display
    const nonZeroBalances = balances
      .filter(balance => parseFloat(balance.amount) > 0)
      .map(balance => ({
        currency: balance.currency,
        amount: parseFloat(balance.amount),
        available: parseFloat(balance.available),
        type: balance.type,
        source: 'gemini'
      }));

    // Convert to USD values
    const balancesWithUSD = await convertBalancesToUSD(
      nonZeroBalances.map(b => ({ amount: b.amount, currency: b.currency }))
    );

    // Merge USD values back into the balance objects
    const enrichedBalances = nonZeroBalances.map((balance, index) => ({
      ...balance,
      usdValue: balancesWithUSD[index]?.usdValue || 0,
    }));

    // Save daily snapshots (async, don't wait)
    const snapshotData = enrichedBalances.map(balance => ({
      source: 'gemini',
      currency: balance.currency,
      amount: balance.amount,
      usdValue: balance.usdValue,
    }));

    saveExternalBalanceSnapshots(session.user.id, snapshotData).catch(error => {
      console.error("Failed to save balance snapshots:", error);
    });

    return NextResponse.json(enrichedBalances);
  } catch (error) {
    console.error("Gemini API error:", error);
    return NextResponse.json(
      { error: "Failed to fetch Gemini balances" },
      { status: 500 }
    );
  }
}