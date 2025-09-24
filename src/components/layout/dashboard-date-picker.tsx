"use client";

import { useEffect, useRef, useState } from "react";
import {
  usePathname,
  useRouter,
  useSearchParams,
  type ReadonlyURLSearchParams,
} from "next/navigation";
import { format, parse } from "date-fns";
import { Button } from "@/components/ui/button";
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
  const dropdownRef = useRef<HTMLDivElement>(null);

  const [monthValue, setMonthValue] = useState(() => monthFromParams(searchParams));
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    setMonthValue(monthFromParams(searchParams));
  }, [searchParams]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleChange = (value: string) => {
    setMonthValue(value);
    setIsOpen(false);

    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set("date", `${value}-01`);
    } else {
      params.delete("date");
    }

    const queryString = params.toString();
    router.replace(queryString ? `${pathname}?${queryString}` : pathname, { scroll: false });
  };

  const generateMonthOptions = () => {
    const options = [];
    const currentDate = new Date();

    // Generate 24 months: current month and 23 months back
    for (let i = 0; i >= -23; i--) {
      const date = new Date(currentDate.getFullYear(), currentDate.getMonth() + i, 1);
      const value = format(date, 'yyyy-MM');
      const label = format(date, 'MMM yyyy');
      options.push({ value, label });
    }

    return options;
  };

  const monthOptions = generateMonthOptions();
  const displayValue = monthOptions.find(option => option.value === monthValue)?.label || format(parse(monthValue, 'yyyy-MM', new Date()), 'MMM yyyy');

  if (!pathname.startsWith("/dashboard")) {
    return null;
  }

  return (
    <div ref={dropdownRef} className="relative">
      <Button
        variant="secondary"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "h-9 w-[180px] justify-between rounded-lg border border-[var(--border)] bg-[color:color-mix(in_srgb,var(--card)_70%,var(--background)_30%)] px-3 text-sm font-medium text-[var(--foreground)] shadow-[0_10px_24px_-20px_rgba(15,23,42,0.65)] transition hover:bg-[color:color-mix(in_srgb,var(--card)_80%,var(--background)_20%)]",
          "focus-visible:border-transparent focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)]"
        )}
      >
        <span>{displayValue}</span>
        <span className={cn("transition-transform duration-200", isOpen && "rotate-180")}>▾</span>
      </Button>

      {isOpen && (
        <div className="absolute top-full mt-1 w-full max-h-[240px] overflow-y-auto rounded-lg border border-[var(--border)] bg-[var(--card)] shadow-lg z-50">
          {monthOptions.map((option) => (
            <button
              key={option.value}
              onClick={() => handleChange(option.value)}
              className={cn(
                "w-full px-3 py-2 text-left text-sm transition hover:bg-[var(--accent)] hover:text-[var(--accent-foreground)]",
                option.value === monthValue && "bg-[var(--accent)] text-[var(--accent-foreground)] font-medium"
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
