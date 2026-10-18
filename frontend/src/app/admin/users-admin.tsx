"use client";

import { useEffect, useState } from "react";

import { useAuth } from "@/components/auth-provider";
import { Pagination } from "@/components/pagination";
import { useToast } from "@/components/toast";
import { Button } from "@/components/ui/button";
import { Alert, Badge, EmptyState, Spinner } from "@/components/ui/feedback";
import { Input, Select } from "@/components/ui/field";
import { ApiError, api } from "@/lib/api-client";
import { formatDate } from "@/lib/format";
import type { Paginated, Role, User } from "@/lib/types";
import { useDebounced } from "@/lib/use-debounced";

const ROLES: Role[] = ["student", "teacher", "admin"];

export function UsersAdmin() {
  const { user: me } = useAuth();
  const notify = useToast();
  const [searchInput, setSearchInput] = useState("");
  const search = useDebounced(searchInput.trim());
  const [role, setRole] = useState<Role | "">("");
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<Paginated<User> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .get<Paginated<User>>("/users", { search, role, page, limit: 10 })
      .then((data) => !cancelled && (setResult(data), setError(null)))
      .catch(
        (err) =>
          !cancelled && setError(err instanceof ApiError ? err.message : "Could not load users."),
      );
    return () => {
      cancelled = true;
    };
  }, [search, role, page]);

  async function update(user: User, changes: Partial<Pick<User, "role" | "is_active">>) {
    setPending(user.id);
    try {
      const updated = await api.patch<User>(`/users/${user.id}`, changes);
      setResult(
        (current) =>
          current && {
            ...current,
            data: current.data.map((u) => (u.id === updated.id ? updated : u)),
          },
      );
      notify(
        changes.role
          ? `${updated.name} is now ${updated.role === "admin" ? "an" : "a"} ${updated.role}.`
          : `${updated.name} was ${updated.is_active ? "re-activated" : "deactivated"}.`,
      );
    } catch (err) {
      notify(err instanceof ApiError ? err.message : "Update failed.", "error");
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <label htmlFor="user-search" className="sr-only">
          Search users
        </label>
        <Input
          id="user-search"
          type="search"
          placeholder="Search name or email…"
          value={searchInput}
          onChange={(e) => {
            setSearchInput(e.target.value);
            setPage(1);
          }}
          className="max-w-xs"
        />
        <label htmlFor="user-role" className="sr-only">
          Filter by role
        </label>
        <Select
          id="user-role"
          value={role}
          onChange={(e) => {
            setRole(e.target.value as Role | "");
            setPage(1);
          }}
          className="w-auto"
        >
          <option value="">All roles</option>
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {r[0]!.toUpperCase() + r.slice(1)}s
            </option>
          ))}
        </Select>
      </div>

      {error ? (
        <Alert>{error}</Alert>
      ) : !result ? (
        <Spinner />
      ) : result.data.length === 0 ? (
        <EmptyState title="No users found" />
      ) : (
        <>
          <div className="relative overflow-x-auto rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-xs font-semibold tracking-wide text-slate-500 uppercase">
                <tr>
                  <th scope="col" className="px-4 py-3">
                    User
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Role
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Status
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Joined
                  </th>
                  <th scope="col" className="px-4 py-3">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {result.data.map((user) => {
                  const self = user.id === me?.id;
                  return (
                    <tr key={user.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <p className="font-medium text-slate-900">
                          {user.name} {self && <Badge tone="emerald">You</Badge>}
                        </p>
                        <p className="text-slate-500">{user.email}</p>
                      </td>
                      <td className="px-4 py-3">
                        <label htmlFor={`role-${user.id}`} className="sr-only">
                          Role for {user.name}
                        </label>
                        <Select
                          id={`role-${user.id}`}
                          value={user.role}
                          disabled={self || pending === user.id}
                          onChange={(e) => update(user, { role: e.target.value as Role })}
                          className="w-32"
                        >
                          {ROLES.map((r) => (
                            <option key={r} value={r}>
                              {r}
                            </option>
                          ))}
                        </Select>
                      </td>
                      <td className="px-4 py-3">
                        <Badge tone={user.is_active ? "emerald" : "slate"}>
                          {user.is_active ? "Active" : "Deactivated"}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-slate-500">
                        {formatDate(user.created_at)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {!self && (
                          <Button
                            size="sm"
                            variant="ghost"
                            loading={pending === user.id}
                            onClick={() => update(user, { is_active: !user.is_active })}
                          >
                            {user.is_active ? "Deactivate" : "Activate"}
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <Pagination meta={result.meta} onPageChange={setPage} />
        </>
      )}
    </div>
  );
}
