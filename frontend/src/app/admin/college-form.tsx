"use client";

import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/feedback";
import { Field, Input, Textarea } from "@/components/ui/field";
import { ApiError } from "@/lib/api-client";
import type { College } from "@/lib/types";

export interface CollegePayload {
  name: string;
  city: string;
  state: string;
  country: string;
  established_year: number | null;
  website: string | null;
  description: string | null;
  courses: string[];
}

type FormValues = Record<
  | "name"
  | "city"
  | "state"
  | "country"
  | "established_year"
  | "website"
  | "description"
  | "courses",
  string
>;

function toForm(college?: College): FormValues {
  return {
    name: college?.name ?? "",
    city: college?.city ?? "",
    state: college?.state ?? "",
    country: college?.country ?? "India",
    established_year: college?.established_year?.toString() ?? "",
    website: college?.website ?? "",
    description: college?.description ?? "",
    courses: college?.courses.join(", ") ?? "",
  };
}

function toPayload(values: FormValues): CollegePayload {
  return {
    name: values.name.trim(),
    city: values.city.trim(),
    state: values.state.trim(),
    country: values.country.trim() || "India",
    established_year: values.established_year ? Number(values.established_year) : null,
    website: values.website.trim() || null,
    description: values.description.trim() || null,
    courses: values.courses
      .split(",")
      .map((course) => course.trim())
      .filter(Boolean),
  };
}

function validate(values: FormValues): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const field of ["name", "city", "state"] as const) {
    if (values[field].trim().length < 2) errors[field] = "Required (at least 2 characters).";
  }
  const year = Number(values.established_year);
  if (
    values.established_year &&
    (!Number.isInteger(year) || year < 1800 || year > new Date().getFullYear())
  ) {
    errors.established_year = `Enter a year between 1800 and ${new Date().getFullYear()}.`;
  }
  if (values.website && !/^https?:\/\/\S+\.\S+/.test(values.website.trim())) {
    errors.website = "Enter a full URL starting with http:// or https://";
  }
  return errors;
}

export function CollegeForm({
  college,
  onSubmit,
  onCancel,
}: {
  college?: College;
  onSubmit: (payload: CollegePayload) => Promise<void>;
  onCancel: () => void;
}) {
  const [values, setValues] = useState<FormValues>(() => toForm(college));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const bind = (field: keyof FormValues) => ({
    value: values[field],
    onChange: (event: { target: { value: string } }) =>
      setValues((v) => ({ ...v, [field]: event.target.value })),
  });

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const clientErrors = validate(values);
    setErrors(clientErrors);
    setFormError(null);
    if (Object.keys(clientErrors).length) return;

    setSubmitting(true);
    try {
      await onSubmit(toPayload(values));
    } catch (error) {
      if (error instanceof ApiError) {
        setErrors(error.fieldErrors);
        setFormError(Object.keys(error.fieldErrors).length ? null : error.message);
      } else {
        setFormError("Something went wrong. Please try again.");
      }
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="grid gap-4 sm:grid-cols-2">
      {formError && <Alert className="sm:col-span-2">{formError}</Alert>}
      <Field label="College name" error={errors.name} className="sm:col-span-2">
        {({ id, invalid, describedBy }) => (
          <Input
            id={id}
            invalid={invalid}
            aria-describedby={describedBy}
            maxLength={150}
            {...bind("name")}
          />
        )}
      </Field>
      <Field label="City" error={errors.city}>
        {({ id, invalid, describedBy }) => (
          <Input id={id} invalid={invalid} aria-describedby={describedBy} {...bind("city")} />
        )}
      </Field>
      <Field label="State" error={errors.state}>
        {({ id, invalid, describedBy }) => (
          <Input id={id} invalid={invalid} aria-describedby={describedBy} {...bind("state")} />
        )}
      </Field>
      <Field label="Country" error={errors.country}>
        {({ id, invalid, describedBy }) => (
          <Input id={id} invalid={invalid} aria-describedby={describedBy} {...bind("country")} />
        )}
      </Field>
      <Field label="Established (year)" error={errors.established_year}>
        {({ id, invalid, describedBy }) => (
          <Input
            id={id}
            type="number"
            inputMode="numeric"
            invalid={invalid}
            aria-describedby={describedBy}
            {...bind("established_year")}
          />
        )}
      </Field>
      <Field label="Website" error={errors.website} className="sm:col-span-2">
        {({ id, invalid, describedBy }) => (
          <Input
            id={id}
            type="url"
            placeholder="https://"
            invalid={invalid}
            aria-describedby={describedBy}
            {...bind("website")}
          />
        )}
      </Field>
      <Field
        label="Courses"
        error={errors.courses}
        hint="Comma separated, e.g. B.Tech, MBA, PhD"
        className="sm:col-span-2"
      >
        {({ id, invalid, describedBy }) => (
          <Input id={id} invalid={invalid} aria-describedby={describedBy} {...bind("courses")} />
        )}
      </Field>
      <Field label="Description" error={errors.description} className="sm:col-span-2">
        {({ id, invalid, describedBy }) => (
          <Textarea
            id={id}
            rows={3}
            maxLength={2000}
            invalid={invalid}
            aria-describedby={describedBy}
            {...bind("description")}
          />
        )}
      </Field>
      <div className="flex justify-end gap-2 sm:col-span-2">
        <Button variant="secondary" onClick={onCancel} disabled={submitting}>
          Cancel
        </Button>
        <Button type="submit" loading={submitting}>
          {college ? "Save changes" : "Create college"}
        </Button>
      </div>
    </form>
  );
}
