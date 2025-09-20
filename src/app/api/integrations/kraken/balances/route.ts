import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { fetchKrakenBalances } from "@/lib/integrations/kraken";
import { convertBalancesToUSD } from "@/lib/crypto-prices";
import { saveExternalBalanceSnapshots } from "@/lib/balance-snapshots";

export async function GET(request: NextRequest) {
  try {
    const session = await getAuthSession();

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const balances = await fetchKrakenBalances();

    // Convert to USD values
    const balancesWithUSD = await convertBalancesToUSD(
      balances.map(b => ({ amount: b.amount, currency: b.currency }))
    );

    // Merge USD values back into the balance objects
    const enrichedBalances = balances.map((balance, index) => ({
      ...balance,
      usdValue: balancesWithUSD[index]?.usdValue || 0,
    }));

    // Save daily snapshots (async, don't wait)
    const snapshotData = enrichedBalances.map(balance => ({
      source: 'kraken',
      currency: balance.currency,
      amount: balance.amount,
      usdValue: balance.usdValue,
    }));

    saveExternalBalanceSnapshots(session.user.id, snapshotData).catch(error => {
      console.error("Failed to save Kraken balance snapshots:", error);
    });

    return NextResponse.json(enrichedBalances);
  } catch (error) {
    console.error("Kraken API error:", error);
    return NextResponse.json(
      { error: "Failed to fetch Kraken balances" },
      { status: 500 }
    );
  }
}