import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";

interface ChangeCardProps {
  title: string;
  name: string;
  change: number;
  currentValue: number;
  currency?: string;
  isPositive?: boolean;
  // Asset-specific props
  isAsset?: boolean;
  pricePerUnit?: number;
}

export function ChangeCard({
  title,
  name,
  change,
  currentValue,
  currency = "USD",
  isPositive = true,
  isAsset = false,
  pricePerUnit
}: ChangeCardProps) {
  const changePercent = currentValue !== 0
    ? ((change / (currentValue - change)) * 100).toFixed(2)
    : "0.00";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-xl font-semibold text-[var(--card-foreground)] truncate">{name}</p>
        <div className="mt-2 flex items-baseline gap-2">
          <p className={`text-2xl font-bold ${isPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
            {isPositive ? '+' : ''}{formatCurrency(change, currency)}
          </p>
          <p className={`text-sm ${isPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
            ({isPositive ? '+' : ''}{changePercent}%)
          </p>
        </div>
        {isAsset && pricePerUnit !== undefined ? (
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">
            Price: {formatCurrency(pricePerUnit, currency)}
          </p>
        ) : (
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">
            Current: {formatCurrency(currentValue, currency)}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
