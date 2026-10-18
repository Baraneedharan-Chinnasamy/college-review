import Link from "next/link";

import { Stars } from "@/components/stars";
import { Skeleton } from "@/components/ui/feedback";
import { formatRating, pluralize } from "@/lib/format";
import type { College } from "@/lib/types";

export function CollegeCard({ college }: { college: College }) {
  return (
    <Link
      href={`/colleges/${college.id}`}
      className="group flex h-full flex-col rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200 transition hover:-translate-y-0.5 hover:shadow-md hover:ring-indigo-200"
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-semibold text-slate-900 group-hover:text-indigo-700">{college.name}</h3>
        <span
          className={
            college.average_rating === null
              ? "shrink-0 rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-500"
              : "shrink-0 rounded-md bg-amber-50 px-2 py-1 text-sm font-semibold text-amber-800"
          }
        >
          {college.average_rating === null ? "New" : `★ ${formatRating(college.average_rating)}`}
        </span>
      </div>
      <p className="mt-1 text-sm text-slate-500">
        {college.city}, {college.state}
        {college.established_year ? ` · Est. ${college.established_year}` : ""}
      </p>
      {college.description && (
        <p className="mt-3 line-clamp-2 text-sm text-slate-600">{college.description}</p>
      )}
      <div className="mt-auto flex items-center gap-2 pt-4 text-sm text-slate-500">
        <Stars value={college.average_rating} size="sm" />
        <span>
          {college.review_count ? pluralize(college.review_count, "review") : "No reviews yet"}
        </span>
      </div>
    </Link>
  );
}

export function CollegeGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="rounded-xl bg-white p-5 ring-1 ring-slate-200">
          <Skeleton className="h-5 w-3/4" />
          <Skeleton className="mt-2 h-4 w-1/2" />
          <Skeleton className="mt-4 h-4 w-full" />
          <Skeleton className="mt-2 h-4 w-5/6" />
          <Skeleton className="mt-5 h-4 w-1/3" />
        </div>
      ))}
    </div>
  );
}
