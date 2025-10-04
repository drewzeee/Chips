import { prisma } from "./prisma";

type RawSnapshotRow = {
  symbol: string;
  totalValue: bigint;
  totalQuantity: unknown;
  asOf: Date;
};

export type SymbolValuationSnapshot = {
  symbol: string;
  totalValue: number;
  totalQuantity: number;
  asOf: Date;
};

export async function getSymbolValuationSnapshot(
  userId: string,
  targetDate: Date
): Promise<SymbolValuationSnapshot[]> {
  const rows = await prisma.$queryRaw<RawSnapshotRow[]>`
    WITH latest_asset_valuations AS (
      SELECT
        iav."investmentAssetId",
        COALESCE(NULLIF(TRIM(ia."symbol"), ''), ia."name") AS raw_symbol,
        iav.value,
        iav.quantity,
        iav."asOf",
        ROW_NUMBER() OVER (
          PARTITION BY iav."investmentAssetId"
          ORDER BY iav."asOf" DESC, iav."createdAt" DESC, iav."id" DESC
        ) AS rn
      FROM "InvestmentAssetValuation" iav
      INNER JOIN "InvestmentAsset" ia ON ia.id = iav."investmentAssetId"
      WHERE ia."userId" = ${userId} AND iav."asOf" <= ${targetDate}
    )
    SELECT
      UPPER(TRIM(raw_symbol)) AS symbol,
      SUM(value)::bigint AS "totalValue",
      SUM(COALESCE(quantity, 0))::numeric AS "totalQuantity",
      MAX("asOf") AS "asOf"
    FROM latest_asset_valuations
    WHERE rn = 1 AND raw_symbol IS NOT NULL AND TRIM(raw_symbol) <> ''
    GROUP BY UPPER(TRIM(raw_symbol))
  `;

  return rows
    .map((row) => {
      const totalQuantity = Number(row.totalQuantity);

      return {
        symbol: row.symbol,
        totalValue: Number(row.totalValue),
        totalQuantity,
        asOf: row.asOf,
      } satisfies SymbolValuationSnapshot;
    })
    .filter((snapshot) => Number.isFinite(snapshot.totalQuantity));
}
