import Form from "next/form";
import Link from "next/link";
import { Suspense } from "react";

import { CollegeCard, CollegeGridSkeleton } from "@/components/college-card";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";
import { serverGet } from "@/lib/server-api";
import type { College, Paginated } from "@/lib/types";

const ROLES = [
  {
    title: "Students",
    body: "Write one honest review per college, and edit or delete it any time.",
  },
  {
    title: "Teachers",
    body: "Review colleges too, and keep college profiles accurate by adding or editing them.",
  },
  {
    title: "Admins",
    body: "Moderate reviews, remove colleges and manage user roles.",
  },
];

export default function HomePage() {
  return (
    <>
      <section className="relative overflow-hidden border-b border-slate-200 bg-white">
        <div
          aria-hidden
          className="absolute inset-0 bg-[radial-gradient(60rem_30rem_at_top,var(--color-indigo-100),transparent)]"
        />
        <div className="relative mx-auto max-w-6xl px-4 py-20 text-center sm:px-6 sm:py-24">
          <p className="mx-auto mb-4 w-fit rounded-full bg-white px-3 py-1 text-xs font-medium text-indigo-700 ring-1 ring-indigo-200">
            Reviews from students and teachers
          </p>
          <h1 className="mx-auto max-w-3xl text-4xl font-bold tracking-tight text-balance text-slate-900 sm:text-5xl">
            Find the right college, from people who have been there.
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg text-slate-600">
            Compare average ratings, read honest reviews about faculty, placements and campus life,
            and share your own experience.
          </p>
          <Form
            action="/colleges"
            className="mx-auto mt-8 flex max-w-xl flex-col gap-2 rounded-2xl bg-white p-2 shadow-lg ring-1 ring-slate-200 sm:flex-row"
          >
            <label htmlFor="home-search" className="sr-only">
              Search colleges
            </label>
            <input
              id="home-search"
              name="search"
              placeholder="Search by college, city or state…"
              className="h-12 flex-1 rounded-xl px-4 text-base text-slate-900 placeholder:text-slate-400 focus:outline-none"
            />
            <button
              type="submit"
              className="h-12 rounded-xl bg-indigo-600 px-6 font-medium text-white hover:bg-indigo-500"
            >
              Search
            </button>
          </Form>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-slate-900">Top rated colleges</h2>
            <p className="mt-1 text-sm text-slate-500">
              Ranked by average rating across all reviews.
            </p>
          </div>
          <Link
            href="/colleges?sort=-rating"
            className="text-sm font-medium whitespace-nowrap text-indigo-600 hover:text-indigo-500"
          >
            View all →
          </Link>
        </div>
        <Suspense fallback={<CollegeGridSkeleton />}>
          <TopColleges />
        </Suspense>
      </section>

      <section className="border-t border-slate-200 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">Who can do what</h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            {ROLES.map((role) => (
              <div key={role.title} className="rounded-xl bg-slate-50 p-6 ring-1 ring-slate-200">
                <h3 className="font-semibold text-slate-900">{role.title}</h3>
                <p className="mt-2 text-sm text-slate-600">{role.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}

async function TopColleges() {
  const result = await serverGet<Paginated<College>>("/colleges", { sort: "-rating", limit: 6 });
  if (!result || result.data.length === 0) {
    return (
      <EmptyState
        title="No colleges yet"
        description="Run the seed script or add a college to get started."
        action={<ButtonLink href="/colleges">Browse colleges</ButtonLink>}
      />
    );
  }
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {result.data.map((college) => (
        <CollegeCard key={college.id} college={college} />
      ))}
    </div>
  );
}
