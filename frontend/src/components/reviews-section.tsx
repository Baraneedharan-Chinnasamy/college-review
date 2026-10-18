"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { useAuth } from "@/components/auth-provider";
import { Pagination } from "@/components/pagination";
import { ReviewCard } from "@/components/review-card";
import { ReviewForm, type ReviewValues } from "@/components/review-form";
import { useToast } from "@/components/toast";
import { Button, buttonClasses } from "@/components/ui/button";
import { Alert, EmptyState, Spinner } from "@/components/ui/feedback";
import { Input, Select } from "@/components/ui/field";
import { ApiError, api } from "@/lib/api-client";
import type { Paginated, Review, ReviewSort } from "@/lib/types";
import { useDebounced } from "@/lib/use-debounced";

const SORTS: Array<{ value: ReviewSort; label: string }> = [
  { value: "newest", label: "Newest" },
  { value: "oldest", label: "Oldest" },
  { value: "-rating", label: "Highest rating" },
  { value: "rating", label: "Lowest rating" },
];

export function ReviewsSection({ collegeId }: { collegeId: string }) {
  const { user, loading: authLoading, hasRole } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const notify = useToast();

  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<ReviewSort>("newest");
  const [searchInput, setSearchInput] = useState("");
  const search = useDebounced(searchInput.trim());

  const [reviews, setReviews] = useState<Paginated<Review> | null>(null);
  const [error, setError] = useState<string | null>(null);
  // The signed-in user's own review, tagged with whose it is so a logout/login never shows a stale one.
  const [mine, setMine] = useState<{ userId: string; review: Review | null } | null>(null);
  const myReview = user && mine?.userId === user.id ? mine.review : null;
  const [editing, setEditing] = useState(false);
  const [version, setVersion] = useState(0); // bump to reload after a write

  useEffect(() => {
    let cancelled = false;
    api
      .get<Paginated<Review>>(`/colleges/${collegeId}/reviews`, {
        page,
        limit: 5,
        sort: search && sort === "newest" ? "relevance" : sort,
        search,
      })
      .then((data) => {
        if (cancelled) return;
        setReviews(data);
        setError(null);
      })
      .catch(
        (err) =>
          !cancelled && setError(err instanceof ApiError ? err.message : "Could not load reviews."),
      );
    return () => {
      cancelled = true;
    };
  }, [collegeId, page, sort, search, version]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    api
      .get<Paginated<Review>>("/reviews", { college_id: collegeId, author_id: user.id, limit: 1 })
      .then((data) => !cancelled && setMine({ userId: user.id, review: data.data[0] ?? null }))
      .catch(() => !cancelled && setMine({ userId: user.id, review: null }));
    return () => {
      cancelled = true;
    };
  }, [collegeId, user, version]);

  const afterWrite = useCallback(
    (message: string) => {
      setEditing(false);
      setVersion((v) => v + 1);
      router.refresh(); // re-render the server-side rating summary
      notify(message);
    },
    [router, notify],
  );

  async function createReview(values: ReviewValues) {
    await api.post<Review>("/reviews", { college_id: collegeId, ...values });
    setPage(1);
    afterWrite("Thanks! Your review is live.");
  }

  async function updateReview(values: ReviewValues) {
    if (!myReview) return;
    await api.patch<Review>(`/reviews/${myReview.id}`, values);
    afterWrite("Review updated.");
  }

  async function deleteReview(review: Review) {
    const own = review.author_id === user?.id;
    if (
      !window.confirm(
        own ? "Delete your review?" : `Delete ${review.author?.name ?? "this user"}'s review?`,
      )
    ) {
      return;
    }
    try {
      await api.delete(`/reviews/${review.id}`);
      afterWrite("Review deleted.");
    } catch (err) {
      notify(err instanceof ApiError ? err.message : "Could not delete the review.", "error");
    }
  }

  return (
    <section aria-labelledby="reviews-heading" className="space-y-6">
      <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        {authLoading ? (
          <Spinner />
        ) : !user ? (
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="font-semibold text-slate-900">Studied or taught here?</h2>
              <p className="text-sm text-slate-500">
                Sign in to share your experience with future students.
              </p>
            </div>
            <Link href={`/login?next=${encodeURIComponent(pathname)}`} className={buttonClasses()}>
              Sign in to review
            </Link>
          </div>
        ) : myReview && !editing ? (
          <div>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-semibold text-slate-900">Your review</h2>
              <div className="flex gap-2">
                <Button size="sm" variant="secondary" onClick={() => setEditing(true)}>
                  Edit
                </Button>
                <Button size="sm" variant="ghost" onClick={() => deleteReview(myReview)}>
                  Delete
                </Button>
              </div>
            </div>
            <ReviewCard review={myReview} highlight />
          </div>
        ) : (
          <div>
            <h2 className="mb-4 font-semibold text-slate-900">
              {myReview ? "Edit your review" : "Write a review"}
            </h2>
            <ReviewForm
              key={myReview?.id ?? "new"}
              initial={
                myReview
                  ? { rating: myReview.rating, title: myReview.title, comment: myReview.comment }
                  : undefined
              }
              submitLabel={myReview ? "Save changes" : "Post review"}
              onSubmit={myReview ? updateReview : createReview}
              onCancel={myReview ? () => setEditing(false) : undefined}
            />
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <h2 id="reviews-heading" className="text-xl font-bold tracking-tight text-slate-900">
          Reviews {reviews ? <span className="text-slate-400">({reviews.meta.total})</span> : null}
        </h2>
        <div className="flex w-full gap-2 sm:w-auto">
          <label htmlFor="review-search" className="sr-only">
            Search reviews
          </label>
          <Input
            id="review-search"
            type="search"
            placeholder="Search reviews…"
            value={searchInput}
            onChange={(e) => {
              setSearchInput(e.target.value);
              setPage(1);
            }}
            className="sm:w-56"
          />
          <label htmlFor="review-sort" className="sr-only">
            Sort reviews
          </label>
          <Select
            id="review-sort"
            value={sort}
            onChange={(e) => {
              setSort(e.target.value as ReviewSort);
              setPage(1);
            }}
            className="w-auto"
          >
            {SORTS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {error ? (
        <Alert>{error}</Alert>
      ) : !reviews ? (
        <Spinner label="Loading reviews" />
      ) : reviews.data.length === 0 ? (
        <EmptyState
          title={search ? `No reviews mention “${search}”` : "No reviews yet"}
          description={search ? "Try another word." : "Be the first to review this college."}
        />
      ) : (
        <div className="space-y-4">
          {reviews.data.map((review) => {
            const own = review.author_id === user?.id;
            return (
              <ReviewCard
                key={review.id}
                review={review}
                highlight={own}
                actions={
                  !own && hasRole("admin") ? (
                    <Button size="sm" variant="ghost" onClick={() => deleteReview(review)}>
                      Remove
                    </Button>
                  ) : undefined
                }
              />
            );
          })}
          <Pagination meta={reviews.meta} onPageChange={setPage} />
        </div>
      )}
    </section>
  );
}
