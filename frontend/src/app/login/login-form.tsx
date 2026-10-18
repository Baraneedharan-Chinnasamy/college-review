"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { useAuth } from "@/components/auth-provider";
import { useToast } from "@/components/toast";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/feedback";
import { Field, Input } from "@/components/ui/field";
import { ApiError } from "@/lib/api-client";

const DEMO_ACCOUNTS = [
  { role: "Admin", email: "admin@collegereview.dev", password: "Admin@123" },
  { role: "Teacher", email: "priya.teacher@collegereview.dev", password: "Password@123" },
  { role: "Student", email: "divya@collegereview.dev", password: "Password@123" },
];

const showDemoAccounts = process.env.NEXT_PUBLIC_SHOW_DEMO_ACCOUNTS !== "false";

export function LoginForm({ next }: { next: string }) {
  const { login } = useAuth();
  const router = useRouter();
  const notify = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setErrors({});
    setFormError(null);
    if (!email || !password) {
      setErrors({
        ...(email ? {} : { email: "Enter your email." }),
        ...(password ? {} : { password: "Enter your password." }),
      });
      return;
    }
    setSubmitting(true);
    try {
      const user = await login(email, password);
      notify(`Welcome back, ${user.name.split(" ")[0]}!`);
      router.replace(next);
      router.refresh();
    } catch (error) {
      if (error instanceof ApiError && Object.keys(error.fieldErrors).length) {
        setErrors(error.fieldErrors);
      } else {
        setFormError(
          error instanceof ApiError ? error.message : "Sign in failed. Please try again.",
        );
      }
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      {formError && <Alert>{formError}</Alert>}
      <Field label="Email" error={errors.email}>
        {({ id, invalid, describedBy }) => (
          <Input
            id={id}
            type="email"
            autoComplete="email"
            invalid={invalid}
            aria-describedby={describedBy}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        )}
      </Field>
      <Field label="Password" error={errors.password}>
        {({ id, invalid, describedBy }) => (
          <Input
            id={id}
            type="password"
            autoComplete="current-password"
            invalid={invalid}
            aria-describedby={describedBy}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        )}
      </Field>
      <Button type="submit" className="w-full" loading={submitting}>
        Sign in
      </Button>

      {showDemoAccounts && (
        <div className="rounded-lg bg-slate-50 p-4 ring-1 ring-slate-200">
          <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
            Demo accounts (from the seed script)
          </p>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {DEMO_ACCOUNTS.map((account) => (
              <button
                key={account.role}
                type="button"
                onClick={() => {
                  setEmail(account.email);
                  setPassword(account.password);
                }}
                className="rounded-md bg-white px-2 py-1.5 text-sm font-medium text-slate-700 ring-1 ring-slate-200 hover:bg-indigo-50 hover:text-indigo-700"
              >
                {account.role}
              </button>
            ))}
          </div>
        </div>
      )}
    </form>
  );
}
