"use client";

import { useState, type FormEvent } from "react";

import { StarInput } from "@/components/star-input";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/feedback";
import { Field, Input, Textarea } from "@/components/ui/field";
import { ApiError } from "@/lib/api-client";

export interface ReviewValues {
  rating: number;
  title: string;
  comment: string;
}

type Errors = Partial<Record<keyof ReviewValues, string>>;

function validate(values: ReviewValues): Errors {
  const errors: Errors = {};
  if (values.rating < 1) errors.rating = "Choose a rating from 1 to 5 stars.";
  if (values.title.trim().length < 3) errors.title = "Title must be at least 3 characters.";
  if (values.comment.trim().length < 10)
    errors.comment = "Tell us a bit more (at least 10 characters).";
  return errors;
}

interface ReviewFormProps {
  initial?: ReviewValues;
  submitLabel: string;
  onSubmit: (values: ReviewValues) => Promise<void>;
  onCancel?: () => void;
}

export function ReviewForm({ initial, submitLabel, onSubmit, onCancel }: ReviewFormProps) {
  const [values, setValues] = useState<ReviewValues>(
    initial ?? { rating: 0, title: "", comment: "" },
  );
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const clientErrors = validate(values);
    setErrors(clientErrors);
    setFormError(null);
    if (Object.keys(clientErrors).length) return;

    setSubmitting(true);
    try {
      await onSubmit({ ...values, title: values.title.trim(), comment: values.comment.trim() });
    } catch (error) {
      if (error instanceof ApiError) {
        setErrors(error.fieldErrors);
        setFormError(Object.keys(error.fieldErrors).length ? null : error.message);
      } else {
        setFormError("Something went wrong. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      {formError && <Alert>{formError}</Alert>}
      <div>
        <p className="mb-1.5 text-sm font-medium text-slate-700">Your rating</p>
        <StarInput
          value={values.rating}
          onChange={(rating) => setValues((v) => ({ ...v, rating }))}
          invalid={Boolean(errors.rating)}
        />
        {errors.rating && <p className="mt-1.5 text-sm text-rose-600">{errors.rating}</p>}
      </div>
      <Field label="Title" error={errors.title}>
        {({ id, invalid, describedBy }) => (
          <Input
            id={id}
            invalid={invalid}
            aria-describedby={describedBy}
            maxLength={120}
            value={values.title}
            onChange={(e) => setValues((v) => ({ ...v, title: e.target.value }))}
            placeholder="Summarise your experience"
          />
        )}
      </Field>
      <Field
        label="Review"
        error={errors.comment}
        hint={`${values.comment.length}/2000 · faculty, placements, campus life, hostels…`}
      >
        {({ id, invalid, describedBy }) => (
          <Textarea
            id={id}
            invalid={invalid}
            aria-describedby={describedBy}
            rows={5}
            maxLength={2000}
            value={values.comment}
            onChange={(e) => setValues((v) => ({ ...v, comment: e.target.value }))}
            placeholder="What should future students know?"
          />
        )}
      </Field>
      <div className="flex justify-end gap-2">
        {onCancel && (
          <Button variant="secondary" onClick={onCancel} disabled={submitting}>
            Cancel
          </Button>
        )}
        <Button type="submit" loading={submitting}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
