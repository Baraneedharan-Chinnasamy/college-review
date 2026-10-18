import type { Metadata } from "next";

import { MyReviews } from "./my-reviews";

export const metadata: Metadata = { title: "My reviews" };

export default function MyReviewsPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <h1 className="text-3xl font-bold tracking-tight text-slate-900">My reviews</h1>
      <p className="mt-1 mb-8 text-slate-500">Edit or delete the reviews you have written.</p>
      <MyReviews />
    </div>
  );
}
