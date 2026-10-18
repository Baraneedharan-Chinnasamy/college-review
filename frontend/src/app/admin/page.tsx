import type { Metadata } from "next";
import { Suspense } from "react";

import { Spinner } from "@/components/ui/feedback";
import { param } from "@/lib/query";

import { AdminDashboard } from "./admin-dashboard";

export const metadata: Metadata = { title: "Manage" };

export default function AdminPage({ searchParams }: PageProps<"/admin">) {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <h1 className="text-3xl font-bold tracking-tight text-slate-900">Manage</h1>
      <p className="mt-1 mb-8 text-slate-500">
        Teachers can add and edit colleges. Admins can also delete colleges and manage users.
      </p>
      <Suspense fallback={<Spinner />}>
        <Dashboard searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Dashboard({ searchParams }: Pick<PageProps<"/admin">, "searchParams">) {
  const params = await searchParams;
  return <AdminDashboard editId={param(params.edit)} create={param(params.new) === "1"} />;
}
