import { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-2xl border border-transparent bg-[var(--card)] backdrop-blur-xl shadow-[0_24px_48px_-32px_rgba(15,23,42,0.45)] ring-1 ring-inset ring-[var(--border)] transition-all hover:-translate-y-[2px] hover:shadow-[0_32px_56px_-28px_rgba(79,70,229,0.28)]",
        className
      )}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "relative flex flex-col gap-1 border-b border-[var(--border)] bg-[color:color-mix(in_srgb,var(--background)_60%,transparent)] px-6 pb-4 pt-6 backdrop-blur-sm",
        className
      )}
      {...props}
    />
  );
}

export function CardTitle({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={cn("text-lg font-semibold tracking-tight text-[var(--card-foreground)]", className)} {...props} />;
}

export function CardContent({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("px-6 pb-6 pt-5", className)} {...props} />;
}
