import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache, Suspense } from "react";

import { RatingSummary } from "@/components/rating-summary";
import { ReviewsSection } from "@/components/reviews-section";
import { StaffOnly } from "@/components/staff-only";
import { ButtonLink } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/feedback";
import { hostname } from "@/lib/format";
import { serverGet } from "@/lib/server-api";
import type { CollegeDetail } from "@/lib/types";

// Shared by generateMetadata and the page so the college is fetched once per request.
const getCollege = cache((id: string) =>
  serverGet<CollegeDetail>(`/colleges/${encodeURIComponent(id)}`),
);

export async function generateMetadata({ params }: PageProps<"/colleges/[id]">): Promise<Metadata> {
  const college = await getCollege((await params).id);
  return college
    ? { title: college.name, description: college.description ?? undefined }
    : { title: "College not found" };
}

export default function CollegePage({ params }: PageProps<"/colleges/[id]">) {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <Link href="/colleges" className="text-sm font-medium text-slate-500 hover:text-slate-900">
        ← All colleges
      </Link>
      <Suspense fallback={<DetailSkeleton />}>
        <CollegeView params={params} />
      </Suspense>
    </div>
  );
}

async function CollegeView({ params }: Pick<PageProps<"/colleges/[id]">, "params">) {
  const college = await getCollege((await params).id);
  if (!college) notFound();

  return (
    <>
      <header className="mt-4 mb-8 flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-3xl">
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">{college.name}</h1>
          <p className="mt-2 text-slate-500">
            {college.city}, {college.state}, {college.country}
            {college.established_year && ` · Established ${college.established_year}`}
            {college.website && (
              <>
                {" · "}
                <a
                  href={college.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-indigo-600 hover:text-indigo-500"
                >
                  {hostname(college.website)} ↗
                </a>
              </>
            )}
          </p>
          {college.description && <p className="mt-4 text-slate-700">{college.description}</p>}
          {college.courses.length > 0 && (
            <ul className="mt-4 flex flex-wrap gap-2" aria-label="Courses offered">
              {college.courses.map((course) => (
                <li
                  key={course}
                  className="rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-600 ring-1 ring-slate-200"
                >
                  {course}
                </li>
              ))}
            </ul>
          )}
        </div>
        <StaffOnly>
          <ButtonLink href={`/admin?edit=${college.id}`} variant="secondary">
            Edit college
          </ButtonLink>
        </StaffOnly>
      </header>

      <div className="grid gap-8 lg:grid-cols-3">
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <RatingSummary college={college} />
        </aside>
        <div className="lg:col-span-2">
          <ReviewsSection collegeId={college.id} />
        </div>
      </div>
    </>
  );
}

function DetailSkeleton() {
  return (
    <div className="mt-4">
      <Skeleton className="h-9 w-2/3" />
      <Skeleton className="mt-3 h-5 w-1/3" />
      <Skeleton className="mt-5 h-16 w-full max-w-3xl" />
      <div className="mt-8 grid gap-8 lg:grid-cols-3">
        <Skeleton className="h-72" />
        <Skeleton className="h-72 lg:col-span-2" />
      </div>
    </div>
  );
}
