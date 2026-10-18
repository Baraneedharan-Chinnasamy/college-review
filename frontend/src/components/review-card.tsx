import Link from "next/link";
import type { ReactNode } from "react";

import { Stars } from "@/components/stars";
import { Badge } from "@/components/ui/feedback";
import { cn } from "@/lib/cn";
import { formatDate, initials } from "@/lib/format";
import type { Review } from "@/lib/types";

interface ReviewCardProps {
  review: Review;
  /** Show which college the review is about (used on "My reviews"). */
  showCollege?: boolean;
  highlight?: boolean;
  actions?: ReactNode;
}

export function ReviewCard({ review, showCollege, highlight, actions }: ReviewCardProps) {
  const author = review.author;
  const edited = review.updated_at !== review.created_at;
  return (
    <article
      className={cn(
        "rounded-xl bg-white p-5 shadow-sm ring-1",
        highlight ? "ring-indigo-300" : "ring-slate-200",
      )}
    >
      <header className="flex flex-wrap items-start justify-between gap-3">
        {showCollege && review.college ? (
          // On "My reviews" the author is always you, so lead with the college instead.
          <div>
            <Link
              href={`/colleges/${review.college.id}`}
              className="font-semibold text-indigo-700 hover:text-indigo-500"
            >
              {review.college.name}
            </Link>
            <p className="text-xs text-slate-500">
              {formatDate(review.created_at)}
              {edited && ` · edited ${formatDate(review.updated_at)}`}
            </p>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-slate-100 text-sm font-semibold text-slate-600">
              {author ? initials(author.name) : "?"}
            </span>
            <div>
              <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-slate-900">
                {author?.name ?? "Deleted user"}
                {author && author.role !== "student" && (
                  <Badge tone={author.role === "teacher" ? "indigo" : "rose"}>{author.role}</Badge>
                )}
                {highlight && <Badge tone="emerald">You</Badge>}
              </p>
              <p className="text-xs text-slate-500">
                {formatDate(review.created_at)}
                {edited && ` · edited ${formatDate(review.updated_at)}`}
              </p>
            </div>
          </div>
        )}
        {actions && <div className="flex gap-1">{actions}</div>}
      </header>

      <div className="mt-3 flex items-center gap-2">
        <Stars value={review.rating} size="sm" />
        <h3 className="font-semibold text-slate-900">{review.title}</h3>
      </div>
      <p className="mt-2 text-sm leading-relaxed whitespace-pre-line text-slate-600">
        {review.comment}
      </p>
    </article>
  );
}
