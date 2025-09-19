"use client";

import { useEffect, useState } from "react";
import {
  usePathname,
  useRouter,
  useSearchParams,
  type ReadonlyURLSearchParams,
} from "next/navigation";
import { format } from "date-fns";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

function monthFromParams(params: URLSearchParams | ReadonlyURLSearchParams) {
  const value = params.get("date");
  if (value && /\d{4}-\d{2}(-\d{2})?/.test(value)) {
    return value.slice(0, 7);
  }
  return format(new Date(), "yyyy-MM");
}

export function DashboardDatePicker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();

  const [monthValue, setMonthValue] = useState(() => monthFromParams(searchParams));

  useEffect(() => {
    setMonthValue(monthFromParams(searchParams));
  }, [searchParams]);

  const handleChange = (value: string) => {
    setMonthValue(value);

    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set("date", `${value}-01`);
    } else {
      params.delete("date");
    }

    const queryString = params.toString();
    router.replace(queryString ? `${pathname}?${queryString}` : pathname, { scroll: false });
  };

  if (!pathname.startsWith("/dashboard")) {
    return null;
  }

  return (
    <div className="relative">
      <Input
        id="dashboard-month-picker"
        type="month"
        value={monthValue}
        onChange={(event) => handleChange(event.target.value)}
        className={cn(
          "h-9 w-[180px] appearance-none rounded-lg border border-[var(--border)] bg-[color:color-mix(in_srgb,var(--card)_70%,var(--background)_30%)] px-3 text-sm font-medium text-[var(--foreground)] shadow-[0_10px_24px_-20px_rgba(15,23,42,0.65)] transition",
          "focus-visible:border-transparent focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)]"
        )}
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-[var(--muted-foreground)]"
      >
        ▾
      </span>
    </div>
  );
}
