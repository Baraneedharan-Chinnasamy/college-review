import { useId, type ComponentProps, type ReactNode } from "react";

import { cn } from "@/lib/cn";

const control =
  "block w-full rounded-lg border-0 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm ring-1 ring-inset placeholder:text-slate-400 focus:ring-2 focus:ring-inset focus:outline-none disabled:bg-slate-50 disabled:text-slate-500";

function controlClasses(invalid: boolean, className?: string) {
  return cn(
    control,
    invalid ? "ring-rose-400 focus:ring-rose-500" : "ring-slate-300 focus:ring-indigo-500",
    className,
  );
}

interface FieldProps {
  label: string;
  error?: string;
  hint?: ReactNode;
  children: (props: { id: string; invalid: boolean; describedBy?: string }) => ReactNode;
  className?: string;
}

/** Label + control + error/hint, wired up with ids for screen readers. */
export function Field({ label, error, hint, children, className }: FieldProps) {
  const id = useId();
  const messageId = `${id}-message`;
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-slate-700">
        {label}
      </label>
      {children({
        id,
        invalid: Boolean(error),
        describedBy: error || hint ? messageId : undefined,
      })}
      {error ? (
        <p id={messageId} className="mt-1.5 text-sm text-rose-600">
          {error}
        </p>
      ) : hint ? (
        <p id={messageId} className="mt-1.5 text-xs text-slate-500">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

interface ControlProps {
  invalid?: boolean;
}

export function Input({
  invalid = false,
  className,
  ...props
}: ComponentProps<"input"> & ControlProps) {
  return (
    <input
      aria-invalid={invalid || undefined}
      className={controlClasses(invalid, className)}
      {...props}
    />
  );
}

export function Textarea({
  invalid = false,
  className,
  ...props
}: ComponentProps<"textarea"> & ControlProps) {
  return (
    <textarea
      aria-invalid={invalid || undefined}
      className={controlClasses(invalid, className)}
      {...props}
    />
  );
}

export function Select({
  invalid = false,
  className,
  ...props
}: ComponentProps<"select"> & ControlProps) {
  return (
    <select
      aria-invalid={invalid || undefined}
      className={controlClasses(invalid, cn("pr-8", className))}
      {...props}
    />
  );
}
