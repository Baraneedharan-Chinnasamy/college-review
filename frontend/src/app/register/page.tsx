import type { Metadata } from "next";
import Link from "next/link";

import { AuthCard } from "@/components/auth-card";

import { RegisterForm } from "./register-form";

export const metadata: Metadata = { title: "Create an account" };

export default function RegisterPage() {
  return (
    <AuthCard
      title="Create your account"
      subtitle="Join to rate colleges and share what it's really like."
      footer={
        <>
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-indigo-600 hover:text-indigo-500">
            Sign in
          </Link>
        </>
      }
    >
      <RegisterForm />
    </AuthCard>
  );
}
