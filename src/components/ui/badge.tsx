import { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const styles: Record<string, string> = {
  default:
    "bg-[var(--accent)] text-[var(--accent-foreground)] ring-1 ring-inset ring-[var(--border)]",
  success:
    "bg-emerald-500/15 text-emerald-700 ring-1 ring-inset ring-emerald-500/30 dark:text-emerald-200",
  warning:
    "bg-amber-400/20 text-amber-700 ring-1 ring-inset ring-amber-400/30 dark:text-amber-200",
  danger:
    "bg-rose-500/15 text-rose-700 ring-1 ring-inset ring-rose-500/30 dark:text-rose-200",
};

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: keyof typeof styles;
}

export function Badge({ className, tone = "default", ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium backdrop-blur",
        styles[tone],
        className
      )}
      {...props}
    />
  );
}
