import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

export function Alert({
  tone = "error",
  children,
  className,
}: {
  tone?: "error" | "success" | "info";
  children: ReactNode;
  className?: string;
}) {
  const tones = {
    error: "bg-rose-50 text-rose-800 ring-rose-200",
    success: "bg-emerald-50 text-emerald-800 ring-emerald-200",
    info: "bg-indigo-50 text-indigo-800 ring-indigo-200",
  };
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cn("rounded-lg px-4 py-3 text-sm ring-1 ring-inset", tones[tone], className)}
    >
      {children}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
      <p className="font-semibold text-slate-900">{title}</p>
      {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn("animate-pulse rounded-md bg-slate-200/70", className)} />;
}

export function Spinner({ label = "Loading" }: { label?: string }) {
  return (
    <div
      role="status"
      className="flex items-center justify-center gap-2 py-10 text-sm text-slate-500"
    >
      <span className="size-5 animate-spin rounded-full border-2 border-indigo-500 border-r-transparent" />
      {label}…
    </div>
  );
}

export function Badge({
  children,
  tone = "slate",
}: {
  children: ReactNode;
  tone?: "slate" | "indigo" | "emerald" | "amber" | "rose";
}) {
  const tones = {
    slate: "bg-slate-100 text-slate-700",
    indigo: "bg-indigo-50 text-indigo-700",
    emerald: "bg-emerald-50 text-emerald-700",
    amber: "bg-amber-50 text-amber-800",
    rose: "bg-rose-50 text-rose-700",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        tones[tone],
      )}
    >
      {children}
    </span>
  );
}
