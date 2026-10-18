import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { AuthCard } from "@/components/auth-card";
import { Spinner } from "@/components/ui/feedback";
import { safeNext } from "@/lib/safe-redirect";

import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <AuthCard
      title="Sign in"
      subtitle="Welcome back! Sign in to write and manage your reviews."
      footer={
        <>
          New here?{" "}
          <Link href="/register" className="font-medium text-indigo-600 hover:text-indigo-500">
            Create an account
          </Link>
        </>
      }
    >
      <Suspense fallback={<Spinner />}>
        <LoginFormWithRedirect searchParams={searchParams} />
      </Suspense>
    </AuthCard>
  );
}

async function LoginFormWithRedirect({ searchParams }: Pick<PageProps<"/login">, "searchParams">) {
  const { next } = await searchParams;
  return <LoginForm next={safeNext(next)} />;
}
