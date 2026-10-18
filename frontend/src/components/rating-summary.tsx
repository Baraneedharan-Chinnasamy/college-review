import { Stars } from "@/components/stars";
import { formatRating, pluralize } from "@/lib/format";
import type { CollegeDetail, Star } from "@/lib/types";

const STARS: Star[] = ["5", "4", "3", "2", "1"];

export function RatingSummary({ college }: { college: CollegeDetail }) {
  const total = college.review_count;
  return (
    <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
      <h2 className="text-sm font-semibold tracking-wide text-slate-500 uppercase">
        Overall rating
      </h2>
      <div className="mt-3 flex items-end gap-3">
        <span className="text-5xl font-bold tracking-tight text-slate-900">
          {formatRating(college.average_rating)}
        </span>
        <span className="pb-1.5 text-sm text-slate-500">/ 5</span>
      </div>
      <Stars value={college.average_rating} size="lg" className="mt-2" />
      <p className="mt-2 text-sm text-slate-500">
        {total ? `Based on ${pluralize(total, "review")}` : "No reviews yet — be the first!"}
      </p>

      <dl className="mt-6 space-y-2">
        {STARS.map((star) => {
          const count = college.rating_distribution[star];
          const percent = total ? Math.round((count / total) * 100) : 0;
          return (
            <div key={star} className="flex items-center gap-3 text-sm">
              <dt className="w-8 shrink-0 text-slate-600">{star}★</dt>
              <dd className="flex flex-1 items-center gap-3">
                <span className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                  <span
                    className="block h-full rounded-full bg-amber-400"
                    style={{ width: `${percent}%` }}
                  />
                </span>
                <span className="w-8 text-right text-slate-500 tabular-nums">{count}</span>
              </dd>
            </div>
          );
        })}
      </dl>
    </div>
  );
}
