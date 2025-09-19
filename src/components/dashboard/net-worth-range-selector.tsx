"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { NET_WORTH_RANGE_OPTIONS, DEFAULT_NET_WORTH_RANGE, type NetWorthRangeValue } from "@/lib/dashboard";
import { cn } from "@/lib/utils";

export function NetWorthRangeSelector() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const current = (() => {
    const value = searchParams.get("range") as NetWorthRangeValue | null;
    return value && NET_WORTH_RANGE_OPTIONS.some((option) => option.value === value)
      ? value
      : DEFAULT_NET_WORTH_RANGE;
  })();

  const handleSelect = (value: NetWorthRangeValue) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value === DEFAULT_NET_WORTH_RANGE) {
      params.delete("range");
    } else {
      params.set("range", value);
    }
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  };

  return (
    <div className="flex items-center gap-2 rounded-full border border-[var(--border)] bg-[color:color-mix(in_srgb,var(--card)_80%,var(--background)_20%)] p-1">
      {NET_WORTH_RANGE_OPTIONS.map((option) => {
        const isActive = option.value === current;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => handleSelect(option.value)}
            className={cn(
              "inline-flex h-8 min-w-[3.25rem] items-center justify-center rounded-full px-3 text-xs font-semibold uppercase tracking-wide transition",
              isActive
                ? "bg-[var(--primary)] text-[var(--primary-foreground)] shadow-[0_12px_24px_-20px_rgba(99,102,241,0.8)]"
                : "text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
