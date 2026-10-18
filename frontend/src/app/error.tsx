"use client";

import { Button } from "@/components/ui/button";

export default function ErrorPage({ error, retry }: { error: unknown; retry: () => void }) {
  const digest = error instanceof Error && "digest" in error ? String(error.digest) : null;
  return (
    <div className="mx-auto flex max-w-xl flex-col items-center px-4 py-24 text-center">
      <p className="text-sm font-semibold text-rose-600">Something went wrong</p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">
        We couldn&apos;t load this page
      </h1>
      <p className="mt-3 text-slate-500">
        The API may be unavailable. Make sure the backend is running, then try again.
      </p>
      {digest && <p className="mt-2 font-mono text-xs text-slate-400">Ref: {digest}</p>}
      <Button onClick={() => retry()} className="mt-8">
        Try again
      </Button>
    </div>
  );
}
