"use client";

import { useEffect, useState } from "react";

import { useAuth } from "@/components/auth-provider";
import { Pagination } from "@/components/pagination";
import { ReviewCard } from "@/components/review-card";
import { ReviewForm, type ReviewValues } from "@/components/review-form";
import { useToast } from "@/components/toast";
import { Button, ButtonLink } from "@/components/ui/button";
import { Alert, EmptyState, Spinner } from "@/components/ui/feedback";
import { ApiError, api } from "@/lib/api-client";
import type { Paginated, Review } from "@/lib/types";

export function MyReviews() {
  const { user, loading } = useAuth();
  const notify = useToast();
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<Paginated<Review> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    api
      .get<Paginated<Review>>("/reviews", { author_id: user.id, page, limit: 10, sort: "newest" })
      .then((data) => !cancelled && (setResult(data), setError(null)))
      .catch(
        (err) =>
          !cancelled &&
          setError(err instanceof ApiError ? err.message : "Could not load your reviews."),
      );
    return () => {
      cancelled = true;
    };
  }, [user, page, version]);

  async function save(review: Review, values: ReviewValues) {
    await api.patch(`/reviews/${review.id}`, values);
    setEditingId(null);
    setVersion((v) => v + 1);
    notify("Review updated.");
  }

  async function remove(review: Review) {
    if (!window.confirm(`Delete your review of ${review.college?.name ?? "this college"}?`)) return;
    try {
      await api.delete(`/reviews/${review.id}`);
      setVersion((v) => v + 1);
      notify("Review deleted.");
    } catch (err) {
      notify(err instanceof ApiError ? err.message : "Could not delete the review.", "error");
    }
  }

  if (loading || (user && !result && !error)) return <Spinner label="Loading your reviews" />;
  if (error) return <Alert>{error}</Alert>;
  if (!result || result.data.length === 0) {
    return (
      <EmptyState
        title="You haven't written any reviews yet"
        description="Find a college you know and share your experience."
        action={<ButtonLink href="/colleges">Browse colleges</ButtonLink>}
      />
    );
  }

  return (
    <div className="space-y-4">
      {result.data.map((review) =>
        editingId === review.id ? (
          <div key={review.id} className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-indigo-300">
            <p className="mb-4 font-semibold text-slate-900">
              Editing your review of {review.college?.name}
            </p>
            <ReviewForm
              initial={{ rating: review.rating, title: review.title, comment: review.comment }}
              submitLabel="Save changes"
              onSubmit={(values) => save(review, values)}
              onCancel={() => setEditingId(null)}
            />
          </div>
        ) : (
          <ReviewCard
            key={review.id}
            review={review}
            showCollege
            actions={
              <>
                <Button size="sm" variant="secondary" onClick={() => setEditingId(review.id)}>
                  Edit
                </Button>
                <Button size="sm" variant="ghost" onClick={() => remove(review)}>
                  Delete
                </Button>
              </>
            }
          />
        ),
      )}
      <Pagination meta={result.meta} onPageChange={setPage} />
    </div>
  );
}
