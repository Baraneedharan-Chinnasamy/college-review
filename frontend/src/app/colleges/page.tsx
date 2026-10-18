import type { Metadata } from "next";
import Form from "next/form";
import { Suspense } from "react";

import { AutoSubmitSelect } from "@/components/auto-submit-select";
import { CollegeCard, CollegeGridSkeleton } from "@/components/college-card";
import { Pagination } from "@/components/pagination";
import { StaffOnly } from "@/components/staff-only";
import { ButtonLink, buttonClasses } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";
import { param, positiveInt, toQueryString } from "@/lib/query";
import { serverGet } from "@/lib/server-api";
import type { College, CollegeSort, Paginated } from "@/lib/types";

export const metadata: Metadata = { title: "Colleges" };

const SORTS: Array<{ value: CollegeSort; label: string }> = [
  { value: "name", label: "Name (A–Z)" },
  { value: "-rating", label: "Highest rated" },
  { value: "rating", label: "Lowest rated" },
  { value: "-reviews", label: "Most reviewed" },
  { value: "newest", label: "Recently added" },
];

const MIN_RATINGS = [
  { value: "", label: "Any rating" },
  { value: "4", label: "4★ & up" },
  { value: "3", label: "3★ & up" },
  { value: "2", label: "2★ & up" },
];

const inputClasses =
  "block h-10 w-full rounded-lg border-0 px-3 text-sm ring-1 ring-slate-300 ring-inset placeholder:text-slate-400 focus:ring-2 focus:ring-indigo-500 focus:outline-none";

export default function CollegesPage({ searchParams }: PageProps<"/colleges">) {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Colleges</h1>
          <p className="mt-1 text-slate-500">Search, filter and compare by average rating.</p>
        </div>
        <StaffOnly>
          <ButtonLink href="/admin?new=1">Add college</ButtonLink>
        </StaffOnly>
      </div>
      <Suspense fallback={<CollegeGridSkeleton count={9} />}>
        <CollegeResults searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function CollegeResults({ searchParams }: Pick<PageProps<"/colleges">, "searchParams">) {
  const params = await searchParams;
  const search = param(params.search)?.trim() ?? "";
  const state = param(params.state)?.trim() ?? "";
  const minRating = param(params.min_rating) ?? "";
  const requestedSort = param(params.sort);
  const sort = SORTS.find((option) => option.value === requestedSort)?.value ?? "name";
  const page = positiveInt(param(params.page), 1);

  const result = await serverGet<Paginated<College>>("/colleges", {
    search,
    state,
    min_rating: minRating,
    sort,
    page,
    limit: 9,
  });

  const hrefFor = (target: number) =>
    `/colleges${toQueryString({ search, state, min_rating: minRating, sort, page: target })}`;
  const hasFilters = Boolean(search || state || minRating);

  return (
    <>
      <Form
        action="/colleges"
        key={`${search}|${state}|${minRating}|${sort}`}
        className="mb-6 grid gap-3 rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200 sm:grid-cols-12"
      >
        <div className="sm:col-span-5">
          <label htmlFor="search" className="sr-only">
            Search
          </label>
          <input
            id="search"
            name="search"
            type="search"
            defaultValue={search}
            placeholder="Search name, city or state…"
            className={inputClasses}
          />
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="state" className="sr-only">
            State
          </label>
          <input
            id="state"
            name="state"
            defaultValue={state}
            placeholder="State"
            className={inputClasses}
          />
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="min_rating" className="sr-only">
            Minimum rating
          </label>
          <AutoSubmitSelect
            id="min_rating"
            name="min_rating"
            defaultValue={minRating}
            className="h-10"
          >
            {MIN_RATINGS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </AutoSubmitSelect>
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="sort" className="sr-only">
            Sort by
          </label>
          <AutoSubmitSelect id="sort" name="sort" defaultValue={sort} className="h-10">
            {SORTS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </AutoSubmitSelect>
        </div>
        <button type="submit" className={buttonClasses("primary", "md", "sm:col-span-1")}>
          Go
        </button>
      </Form>

      {!result || result.data.length === 0 ? (
        <EmptyState
          title="No colleges match your filters"
          description={hasFilters ? "Try a different search term or clear the filters." : undefined}
          action={
            hasFilters ? (
              <ButtonLink href="/colleges" variant="secondary">
                Clear filters
              </ButtonLink>
            ) : undefined
          }
        />
      ) : (
        <div className="space-y-8">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {result.data.map((college) => (
              <CollegeCard key={college.id} college={college} />
            ))}
          </div>
          <Pagination meta={result.meta} hrefFor={hrefFor} />
        </div>
      )}
    </>
  );
}
