import Link from "next/link";

import { cn } from "@/lib/cn";
import type { PageMeta } from "@/lib/types";

const base =
  "inline-flex h-9 min-w-9 items-center justify-center rounded-lg px-3 text-sm font-medium ring-1 ring-inset";

function pageWindow(current: number, total: number): Array<number | "…"> {
  const pages = new Set([1, total, current - 1, current, current + 1]);
  const sorted = [...pages].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b);
  const result: Array<number | "…"> = [];
  sorted.forEach((page, i) => {
    if (i > 0 && page - sorted[i - 1]! > 1) result.push("…");
    result.push(page);
  });
  return result;
}

interface PaginationProps {
  meta: PageMeta;
  /** Link mode: builds `href`s (server-rendered pages). */
  hrefFor?: (page: number) => string;
  /** Button mode: calls back (client-side lists). */
  onPageChange?: (page: number) => void;
}

export function Pagination({ meta, hrefFor, onPageChange }: PaginationProps) {
  if (meta.total_pages <= 1) return null;

  const item = (page: number, label: string, disabled: boolean, active = false) => {
    const classes = cn(
      base,
      active
        ? "bg-indigo-600 text-white ring-indigo-600"
        : "bg-white text-slate-700 ring-slate-300 hover:bg-slate-50",
      disabled && "pointer-events-none opacity-40",
    );
    if (hrefFor) {
      return (
        <Link
          key={label}
          href={hrefFor(page)}
          className={classes}
          aria-current={active ? "page" : undefined}
          aria-disabled={disabled || undefined}
          scroll={false}
        >
          {label}
        </Link>
      );
    }
    return (
      <button
        key={label}
        type="button"
        className={classes}
        disabled={disabled}
        aria-current={active ? "page" : undefined}
        onClick={() => onPageChange?.(page)}
      >
        {label}
      </button>
    );
  };

  return (
    <nav aria-label="Pagination" className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-sm text-slate-500">
        Page {meta.page} of {meta.total_pages} · {meta.total} results
      </p>
      <div className="flex flex-wrap gap-1.5">
        {item(meta.page - 1, "Previous", !meta.has_prev)}
        {pageWindow(meta.page, meta.total_pages).map((page, i) =>
          page === "…" ? (
            <span key={`gap-${i}`} className="px-1 py-2 text-sm text-slate-400">
              …
            </span>
          ) : (
            item(page, String(page), false, page === meta.page)
          ),
        )}
        {item(meta.page + 1, "Next", !meta.has_next)}
      </div>
    </nav>
  );
}
