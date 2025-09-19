"use client";

import { useRouter } from "next/navigation";
import { Select } from "@/components/ui/select";

interface MonthSelectorProps {
  value: string;
  options: { value: string; label: string }[];
}

export function MonthSelector({ value, options }: MonthSelectorProps) {
  const router = useRouter();

  return (
    <Select
      value={value}
      onChange={(event) => router.push(`/reports/monthly?month=${event.target.value}`)}
      className="w-full sm:w-56"
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </Select>
  );
}
