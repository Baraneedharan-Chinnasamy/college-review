"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { useAuth } from "@/components/auth-provider";
import { useToast } from "@/components/toast";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/feedback";
import { Field, Input } from "@/components/ui/field";
import { ApiError } from "@/lib/api-client";
import { cn } from "@/lib/cn";

type RegisterRole = "student" | "teacher";

interface Values {
  name: string;
  email: string;
  password: string;
  role: RegisterRole;
}

function validate(values: Values): Record<string, string> {
  const errors: Record<string, string> = {};
  if (values.name.trim().length < 2) errors.name = "Enter your full name.";
  if (!/^\S+@\S+\.\S+$/.test(values.email)) errors.email = "Enter a valid email address.";
  if (values.password.length < 8) errors.password = "Use at least 8 characters.";
  else if (!/[A-Za-z]/.test(values.password) || !/\d/.test(values.password)) {
    errors.password = "Include at least one letter and one number.";
  }
  return errors;
}

const ROLE_OPTIONS: Array<{ value: RegisterRole; title: string; body: string }> = [
  { value: "student", title: "Student", body: "Review colleges you study or studied at." },
  {
    value: "teacher",
    title: "Teacher",
    body: "Review colleges and help keep their profiles accurate.",
  },
];

export function RegisterForm() {
  const { register } = useAuth();
  const router = useRouter();
  const notify = useToast();
  const [values, setValues] = useState<Values>({
    name: "",
    email: "",
    password: "",
    role: "student",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const set = (field: keyof Values) => (event: { target: { value: string } }) =>
    setValues((v) => ({ ...v, [field]: event.target.value }));

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const clientErrors = validate(values);
    setErrors(clientErrors);
    setFormError(null);
    if (Object.keys(clientErrors).length) return;

    setSubmitting(true);
    try {
      const user = await register({ ...values, name: values.name.trim() });
      notify(`Welcome, ${user.name.split(" ")[0]}! Your account is ready.`);
      router.replace("/colleges");
      router.refresh();
    } catch (error) {
      if (error instanceof ApiError && Object.keys(error.fieldErrors).length) {
        setErrors(error.fieldErrors);
      } else {
        setFormError(
          error instanceof ApiError ? error.message : "Sign up failed. Please try again.",
        );
      }
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      {formError && <Alert>{formError}</Alert>}
      <Field label="Full name" error={errors.name}>
        {({ id, invalid, describedBy }) => (
          <Input
            id={id}
            autoComplete="name"
            invalid={invalid}
            aria-describedby={describedBy}
            value={values.name}
            onChange={set("name")}
          />
        )}
      </Field>
      <Field label="Email" error={errors.email}>
        {({ id, invalid, describedBy }) => (
          <Input
            id={id}
            type="email"
            autoComplete="email"
            invalid={invalid}
            aria-describedby={describedBy}
            value={values.email}
            onChange={set("email")}
          />
        )}
      </Field>
      <Field
        label="Password"
        error={errors.password}
        hint="At least 8 characters, with a letter and a number."
      >
        {({ id, invalid, describedBy }) => (
          <Input
            id={id}
            type="password"
            autoComplete="new-password"
            invalid={invalid}
            aria-describedby={describedBy}
            value={values.password}
            onChange={set("password")}
          />
        )}
      </Field>
      <fieldset>
        <legend className="mb-1.5 text-sm font-medium text-slate-700">I am a…</legend>
        <div className="grid grid-cols-2 gap-3">
          {ROLE_OPTIONS.map((option) => (
            <label
              key={option.value}
              className={cn(
                "cursor-pointer rounded-lg p-3 ring-1 transition has-focus-visible:ring-2 has-focus-visible:ring-indigo-500",
                values.role === option.value
                  ? "bg-indigo-50 ring-indigo-500"
                  : "bg-white ring-slate-300 hover:bg-slate-50",
              )}
            >
              <input
                type="radio"
                name="role"
                value={option.value}
                checked={values.role === option.value}
                onChange={set("role")}
                className="sr-only"
              />
              <span className="block text-sm font-semibold text-slate-900">{option.title}</span>
              <span className="mt-0.5 block text-xs text-slate-500">{option.body}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <Button type="submit" className="w-full" loading={submitting}>
        Create account
      </Button>
    </form>
  );
}
