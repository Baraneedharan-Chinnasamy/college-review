"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { useAuth } from "@/components/auth-provider";
import { Pagination } from "@/components/pagination";
import { useToast } from "@/components/toast";
import { Button } from "@/components/ui/button";
import { Alert, EmptyState, Spinner } from "@/components/ui/feedback";
import { Input } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { ApiError, api } from "@/lib/api-client";
import { formatRating } from "@/lib/format";
import type { College, CollegeDetail, Paginated } from "@/lib/types";
import { useDebounced } from "@/lib/use-debounced";

import { CollegeForm, type CollegePayload } from "./college-form";

type Editor = { mode: "create" } | { mode: "edit"; college: College } | null;

export function CollegesAdmin({
  initialEditId,
  startWithCreate,
}: {
  initialEditId?: string;
  startWithCreate?: boolean;
}) {
  const { hasRole } = useAuth();
  const notify = useToast();
  const isAdmin = hasRole("admin");

  const [searchInput, setSearchInput] = useState("");
  const search = useDebounced(searchInput.trim());
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<Paginated<College> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  const [editor, setEditor] = useState<Editor>(startWithCreate ? { mode: "create" } : null);

  useEffect(() => {
    let cancelled = false;
    api
      .get<Paginated<College>>("/colleges", { search, page, limit: 10, sort: "name" })
      .then((data) => !cancelled && (setResult(data), setError(null)))
      .catch(
        (err) =>
          !cancelled &&
          setError(err instanceof ApiError ? err.message : "Could not load colleges."),
      );
    return () => {
      cancelled = true;
    };
  }, [search, page, version]);

  // Deep link from a college page: /admin?edit=<id>
  useEffect(() => {
    if (!initialEditId) return;
    api
      .get<CollegeDetail>(`/colleges/${initialEditId}`)
      .then((college) => setEditor({ mode: "edit", college }))
      .catch(() => notify("That college no longer exists.", "error"));
  }, [initialEditId, notify]);

  const close = useCallback(() => setEditor(null), []);

  async function save(payload: CollegePayload) {
    if (editor?.mode === "edit") {
      await api.patch(`/colleges/${editor.college.id}`, payload);
      notify(`Saved “${payload.name}”.`);
    } else {
      await api.post("/colleges", payload);
      notify(`Created “${payload.name}”.`);
    }
    setEditor(null);
    setVersion((v) => v + 1);
  }

  async function remove(college: College) {
    const reviews = college.review_count ? ` and its ${college.review_count} review(s)` : "";
    if (!window.confirm(`Delete “${college.name}”${reviews}? This cannot be undone.`)) return;
    try {
      await api.delete(`/colleges/${college.id}`);
      notify(`Deleted “${college.name}”.`);
      setVersion((v) => v + 1);
    } catch (err) {
      notify(err instanceof ApiError ? err.message : "Could not delete the college.", "error");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <label htmlFor="college-admin-search" className="sr-only">
          Search colleges
        </label>
        <Input
          id="college-admin-search"
          type="search"
          placeholder="Search colleges…"
          value={searchInput}
          onChange={(e) => {
            setSearchInput(e.target.value);
            setPage(1);
          }}
          className="max-w-xs"
        />
        <Button onClick={() => setEditor({ mode: "create" })}>Add college</Button>
      </div>

      {error ? (
        <Alert>{error}</Alert>
      ) : !result ? (
        <Spinner />
      ) : result.data.length === 0 ? (
        <EmptyState title="No colleges found" />
      ) : (
        <>
          <div className="relative overflow-x-auto rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-xs font-semibold tracking-wide text-slate-500 uppercase">
                <tr>
                  <th scope="col" className="px-4 py-3">
                    College
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Location
                  </th>
                  <th scope="col" className="px-4 py-3 text-right">
                    Rating
                  </th>
                  <th scope="col" className="px-4 py-3 text-right">
                    Reviews
                  </th>
                  <th scope="col" className="px-4 py-3 text-right">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {result.data.map((college) => (
                  <tr key={college.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-900">
                      <Link href={`/colleges/${college.id}`} className="hover:text-indigo-600">
                        {college.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-slate-500">
                      {college.city}, {college.state}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-700 tabular-nums">
                      {formatRating(college.average_rating)}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-700 tabular-nums">
                      {college.review_count}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setEditor({ mode: "edit", college })}
                        >
                          Edit
                        </Button>
                        {isAdmin && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                            onClick={() => remove(college)}
                          >
                            Delete
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination meta={result.meta} onPageChange={setPage} />
        </>
      )}

      <Modal
        open={editor !== null}
        onClose={close}
        title={editor?.mode === "edit" ? `Edit ${editor.college.name}` : "Add a college"}
      >
        {editor && (
          <CollegeForm
            key={editor.mode === "edit" ? editor.college.id : "new"}
            college={editor.mode === "edit" ? editor.college : undefined}
            onSubmit={save}
            onCancel={close}
          />
        )}
      </Modal>
    </div>
  );
}
