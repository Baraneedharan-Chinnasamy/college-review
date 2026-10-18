"use client";

import type { ReactNode } from "react";

import { useAuth } from "@/components/auth-provider";
import type { Role } from "@/lib/types";

/** Renders children only for signed-in users with one of the given roles (UI hint; the API enforces it). */
export function RoleGate({ roles, children }: { roles: Role[]; children: ReactNode }) {
  const { hasRole } = useAuth();
  return hasRole(...roles) ? children : null;
}

export function StaffOnly({ children }: { children: ReactNode }) {
  return <RoleGate roles={["admin", "teacher"]}>{children}</RoleGate>;
}
