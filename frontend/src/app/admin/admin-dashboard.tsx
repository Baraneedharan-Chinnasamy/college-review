"use client";

import { useState } from "react";

import { useAuth } from "@/components/auth-provider";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState, Spinner } from "@/components/ui/feedback";
import { cn } from "@/lib/cn";

import { CollegesAdmin } from "./colleges-admin";
import { UsersAdmin } from "./users-admin";

type Tab = "colleges" | "users";

export function AdminDashboard({ editId, create }: { editId?: string; create?: boolean }) {
  const { user, loading, hasRole } = useAuth();
  const [tab, setTab] = useState<Tab>("colleges");

  if (loading) return <Spinner />;
  if (!user || !hasRole("admin", "teacher")) {
    return (
      <EmptyState
        title="You don't have access to this page"
        description="Managing colleges is available to teachers and admins."
        action={<ButtonLink href="/colleges">Back to colleges</ButtonLink>}
      />
    );
  }

  const tabs: Array<{ id: Tab; label: string; show: boolean }> = [
    { id: "colleges", label: "Colleges", show: true },
    { id: "users", label: "Users", show: hasRole("admin") },
  ];

  return (
    <div>
      <div
        role="tablist"
        aria-label="Admin sections"
        className="mb-6 flex gap-1 border-b border-slate-200"
      >
        {tabs
          .filter((t) => t.show)
          .map((t) => (
            <button
              key={t.id}
              role="tab"
              type="button"
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                "-mb-px border-b-2 px-4 py-2.5 text-sm font-medium",
                tab === t.id
                  ? "border-indigo-600 text-indigo-700"
                  : "border-transparent text-slate-500 hover:text-slate-800",
              )}
            >
              {t.label}
            </button>
          ))}
      </div>
      <div role="tabpanel">
        {tab === "colleges" ? (
          <CollegesAdmin initialEditId={editId} startWithCreate={create} />
        ) : (
          <UsersAdmin />
        )}
      </div>
    </div>
  );
}
